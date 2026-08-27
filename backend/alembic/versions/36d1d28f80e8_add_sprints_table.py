"""add_sprints_table

Revision ID: 36d1d28f80e8
Revises: f89ea7206fbc
Create Date: 2026-08-27 11:20:14.738845
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '36d1d28f80e8'
down_revision: Union[str, None] = 'f89ea7206fbc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    sprint_status = sa.Enum('PLANNED', 'ACTIVE', 'COMPLETED', name='sprint_status')

    op.create_table('sprints',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('goal', sa.String(length=2000), nullable=True),
        sa.Column('status', sprint_status, nullable=False),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sprints_project_id'), 'sprints', ['project_id'], unique=False)
    op.create_foreign_key('fk_issues_sprint_id', 'issues', 'sprints', ['sprint_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_issues_sprint_id', 'issues', type_='foreignkey')
    op.drop_index(op.f('ix_sprints_project_id'), table_name='sprints')
    op.drop_table('sprints')
    sa.Enum(name='sprint_status').drop(op.get_bind(), checkfirst=True)
