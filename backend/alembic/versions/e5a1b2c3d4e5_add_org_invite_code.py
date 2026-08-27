"""add_org_invite_code

Revision ID: e5a1b2c3d4e5
Revises: ce6d8988428f
Create Date: 2026-08-27 15:21:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e5a1b2c3d4e5'
down_revision: Union[str, None] = 'ce6d8988428f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('invite_code', sa.String(length=32), nullable=True))
    op.create_index(op.f('ix_organizations_invite_code'), 'organizations', ['invite_code'], unique=True)
    # Populate existing orgs if any with default random codes
    op.execute("UPDATE organizations SET invite_code = UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 8)) WHERE invite_code IS NULL")
    op.alter_column('organizations', 'invite_code', nullable=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_organizations_invite_code'), table_name='organizations')
    op.drop_column('organizations', 'invite_code')
