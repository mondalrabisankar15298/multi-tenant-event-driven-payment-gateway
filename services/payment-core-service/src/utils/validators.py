import re

SCHEMA_PATTERN = re.compile(r'^m_[a-f0-9]{32}$')

def validate_schema_name(schema: str) -> str:
    if not SCHEMA_PATTERN.match(schema):
        raise ValueError(f"Invalid schema name: {schema}")
    return schema
