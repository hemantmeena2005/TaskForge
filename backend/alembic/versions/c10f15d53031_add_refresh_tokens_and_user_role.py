"""add_refresh_tokens_and_user_role

Revision ID: c10f15d53031
Revises: 8eb19bcd438b
Create Date: 2026-08-27 10:58:14.160356
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c10f15d53031'
down_revision: Union[str, None] = '8eb19bcd438b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the system_role enum type first
    system_role = sa.Enum('USER', 'SUPER_ADMIN', name='system_role')
    system_role.create(op.get_bind(), checkfirst=True)

    # Create refresh_tokens table
    op.create_table('refresh_tokens',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('token', sa.String(length=512), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_refresh_tokens_token'), 'refresh_tokens', ['token'], unique=True)
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)

    # Add role column to users with a default for existing rows
    op.add_column('users', sa.Column('role', system_role, nullable=False, server_default='USER'))


def downgrade() -> None:
    op.drop_column('users', 'role')
    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_token'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
    sa.Enum(name='system_role').drop(op.get_bind(), checkfirst=True)
