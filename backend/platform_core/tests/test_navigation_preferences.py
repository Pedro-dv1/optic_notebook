from datetime import timedelta
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from accounts.models import AccountVerificationChallenge, User
from bookings.models import BookingPushSubscription, NotificationEvent, PushSubscription
from bookings.notifications import _send, process_due_notifications
from bookings.operations import create_appointment
from .helpers import PASSWORD, create_booking_catalog, create_company


@override_settings(TURNSTILE_REQUIRED=False)
class PasswordRecoveryTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('recover@example.com', PASSWORD, full_name='Recovery Customer')
        self.sender = patch('accounts.account_security.email_service.send_security_otp').start()
        patch('accounts.account_security.email_service.send_password_changed').start()
        self.addCleanup(patch.stopall)

    def request_code(self, email='recover@example.com'):
        return self.client.post('/api/v1/customers/security/password/request/', {'email': email}, format='json')

    def verify(self, challenge, code):
        return self.client.post('/api/v1/customers/security/password/verify/', {'challenge_id': challenge, 'code': code}, format='json')

    def test_anonymous_reuses_code_authorization_password_validation_and_session_revocation(self):
        response = self.request_code()
        self.assertEqual(response.status_code, 201)
        challenge = AccountVerificationChallenge.objects.get(pk=response.data['challenge_id'])
        self.assertEqual(challenge.purpose, 'PASSWORD_CHANGE')
        code = self.sender.call_args.kwargs['code']
        self.assertNotEqual(challenge.code_hash, code)
        verified = self.verify(challenge.id, code)
        self.assertEqual(verified.status_code, 200)
        token = verified.data['authorization_token']
        url = '/api/v1/customers/password/change/'
        payload = {'authorization_token': token, 'new_password': PASSWORD, 'new_password_confirm': PASSWORD}
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 400)
        payload.update(new_password='Another-Correct-Horse-2026!', new_password_confirm='Another-Correct-Horse-2026!')
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 204)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(payload['new_password']))
        self.assertEqual(self.user.auth_version, 1)
        self.assertEqual(self.client.post(url, payload, format='json').status_code, 400)
        self.assertEqual(self.verify(challenge.id, code).status_code, 400)

    def test_unknown_and_inactive_email_have_same_public_contract(self):
        valid = self.request_code()
        unknown = self.request_code('unknown@example.com')
        self.assertEqual(unknown.status_code, valid.status_code)
        self.assertEqual(set(unknown.data), set(valid.data))
        self.assertEqual(self.verify(unknown.data['challenge_id'], '123456').status_code, 400)
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        self.sender.reset_mock()
        self.assertEqual(self.request_code().status_code, 201)
        self.sender.assert_not_called()

    def test_cooldown_expiration_and_attempt_limit_are_shared(self):
        response = self.request_code()
        self.assertEqual(self.request_code().status_code, 201)
        self.assertEqual(self.sender.call_count, 1)
        challenge = AccountVerificationChallenge.objects.get(pk=response.data['challenge_id'])
        correct = self.sender.call_args.kwargs['code']
        wrong = '000000' if correct != '000000' else '999999'
        for _ in range(4):
            self.assertEqual(self.verify(challenge.id, wrong).status_code, 400)
        self.assertEqual(self.verify(challenge.id, wrong).status_code, 429)
        self.assertEqual(self.verify(challenge.id, correct).status_code, 400)
        challenge.consumed_at = None
        challenge.expires_at = timezone.now() - timedelta(seconds=1)
        challenge.save(update_fields=['consumed_at', 'expires_at'])
        self.assertEqual(self.verify(challenge.id, correct).data['errors']['code'], 'otp_expired')

    def test_request_rate_limit_also_applies_to_unknown_addresses(self):
        for _ in range(5):
            self.assertEqual(self.request_code('unknown@example.com').status_code, 201)
        self.assertEqual(self.request_code('unknown@example.com').status_code, 429)

    def test_authenticated_customer_cannot_verify_another_accounts_code(self):
        response = self.request_code()
        other = User.objects.create_user('other-recovery@example.com', PASSWORD)
        self.client.force_authenticate(other)
        self.assertEqual(self.verify(response.data['challenge_id'], self.sender.call_args.kwargs['code']).status_code, 400)

    def test_public_request_requires_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        response = client.post('/api/v1/customers/security/password/request/', {'email': self.user.email}, format='json')
        self.assertEqual(response.status_code, 403)
        self.sender.assert_not_called()


@override_settings(TURNSTILE_REQUIRED=False)
class NotificationPreferenceTests(APITestCase):
    def setUp(self):
        self.owner, self.company = create_company('notification-choice')
        self.service, self.professional, self.start = create_booking_catalog(self.company)
        self.user = User.objects.create_user('preference@example.com', PASSWORD, full_name='Customer', whatsapp='+5511999999999')
        self.client.force_authenticate(self.user)

    def appointment(self, customer):
        return create_appointment(
            company=self.company, service_id=self.service.id, professional_id=self.professional.id,
            starts_at=self.start, customer=customer,
            customer_data={'customer_name': 'Customer', 'customer_email': 'preference@example.com', 'customer_whatsapp': '+5511999999999'},
        )[0]

    def subscription(self, user):
        return PushSubscription.objects.create(endpoint=f'https://fcm.googleapis.com/{user.pk}', endpoint_digest=str(user.pk), p256dh='key', auth='auth', user=user, active=True)

    def test_null_true_false_persist_and_cannot_change_another_profile(self):
        url = '/api/v1/customers/profile/me/'
        self.assertIsNone(self.client.get(url).data['notification_preference'])
        for choice in (True, False):
            response = self.client.patch(url, {'notification_preference': choice, 'id': str(self.owner.id)}, format='json')
            self.assertEqual(response.status_code, 200)
            self.user.refresh_from_db()
            self.assertIs(self.user.notification_preference, choice)
            another_device = APIClient()
            another_device.force_authenticate(self.user)
            self.assertIs(another_device.get('/api/v1/auth/me/').data['notification_preference'], choice)
        self.owner.refresh_from_db()
        self.assertIsNone(self.owner.notification_preference)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.patch(url, {'notification_preference': True}, format='json').status_code, 401)

    def test_enabled_preference_reuses_only_the_customers_active_devices(self):
        own = self.subscription(self.user)
        self.subscription(self.owner)
        self.user.notification_preference = True
        self.user.save(update_fields=['notification_preference'])
        appointment = self.appointment(self.user)
        self.assertEqual(list(appointment.push_links.values_list('subscription_id', flat=True)), [own.id])
        self.user.notification_preference = False
        self.user.save(update_fields=['notification_preference'])
        event = NotificationEvent.objects.get(appointment=appointment)
        with patch('pywebpush.webpush') as sender:
            self.assertEqual(_send(event), 0)
            sender.assert_not_called()
        event.scheduled_for = timezone.now() - timedelta(seconds=1)
        event.save(update_fields=['scheduled_for'])
        with patch('pywebpush.webpush') as sender:
            self.assertEqual(process_due_notifications(limit=1), 1)
            sender.assert_not_called()
        event.refresh_from_db()
        self.assertEqual(event.state, NotificationEvent.State.SENT)

    def test_declined_unanswered_and_guest_bookings_do_not_link_account_devices(self):
        self.subscription(self.user)
        for choice in (None, False):
            self.user.notification_preference = choice
            self.user.save(update_fields=['notification_preference'])
            appointment = self.appointment(self.user)
            self.assertFalse(BookingPushSubscription.objects.filter(appointment=appointment).exists())
            appointment.delete()
        guest = self.appointment(None)
        self.assertIsNone(guest.customer_id)
        self.assertFalse(guest.push_links.exists())
