import unicodedata
from functools import reduce
from operator import or_

from django.db.models import Q


def accent_insensitive_query(value, *fields):
    """Build one PostgreSQL unaccent/case-insensitive query for trusted field names."""
    return reduce(or_, (Q(**{f"{field}__unaccent__icontains": value}) for field in fields))


def normalize_search(value):
    return "".join(
        character
        for character in unicodedata.normalize("NFKD", value).casefold()
        if not unicodedata.combining(character)
    )


def normalized_contains(needle, haystack):
    return normalize_search(needle) in normalize_search(haystack)
