"""step1 accounts and harvest records"""
from alembic import context, op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    if op.get_context().dialect.name == 'postgresql':
        skip_postgis = context.get_x_argument(as_dictionary=True).get('skip_postgis') == 'true'
        if skip_postgis:
            from app.config import settings
            if settings().environment != 'development':
                raise ValueError('skip_postgis is only allowed in development')
        else:
            op.execute('CREATE EXTENSION IF NOT EXISTS postgis')
    op.create_table('otp_states',
    sa.Column('phone_hash', sa.String(length=64), nullable=False),
    sa.Column('code_hash', sa.String(length=64), nullable=True),
    sa.Column('expires_at', sa.DateTime(), nullable=True),
    sa.Column('requested_at', sa.DateTime(), nullable=True),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('failures', sa.Integer(), nullable=False),
    sa.Column('failure_times', sa.JSON(), nullable=False),
    sa.Column('window_start', sa.DateTime(), nullable=True),
    sa.Column('locked_until', sa.DateTime(), nullable=True),
    sa.Column('language', sa.String(length=2), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.PrimaryKeyConstraint('phone_hash')
    )
    op.create_table('roles',
    sa.Column('name', sa.String(length=20), nullable=False),
    sa.PrimaryKeyConstraint('name')
    )
    op.bulk_insert(sa.table('roles', sa.column('name', sa.String)),
                   [{'name': name} for name in ('farmer', 'advisor', 'buyer', 'logistics', 'fpo', 'admin')])
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('phone_hash', sa.String(length=64), nullable=False),
    sa.Column('phone_encrypted', sa.Text(), nullable=False),
    sa.Column('name_encrypted', sa.Text(), nullable=True),
    sa.Column('language', sa.String(length=2), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.ForeignKeyConstraint(['role'], ['roles.name'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('phone_hash')
    )
    op.create_table('audit_log',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('actor_id', sa.Integer(), nullable=True),
    sa.Column('action', sa.String(length=60), nullable=False),
    sa.Column('record_type', sa.String(length=30), nullable=True),
    sa.Column('record_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('consents',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('owner_id', sa.Integer(), nullable=False),
    sa.Column('advisor_id', sa.Integer(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('revoked', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['advisor_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('farms',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('owner_id', sa.Integer(), nullable=False),
    sa.Column('entered_by', sa.Integer(), nullable=False),
    sa.Column('updated_by', sa.Integer(), nullable=False),
    sa.Column('district', sa.String(length=100), nullable=False),
    sa.Column('village', sa.String(length=100), nullable=False),
    sa.Column('latitude', sa.Numeric(precision=10, scale=7), nullable=False),
    sa.Column('longitude', sa.Numeric(precision=10, scale=7), nullable=False),
    sa.Column('area_acres', sa.Numeric(precision=16, scale=6), nullable=False),
    sa.Column('entered_area', sa.Numeric(precision=16, scale=6), nullable=False),
    sa.Column('area_unit', sa.String(length=10), nullable=False),
    sa.Column('storage_capacity_qtl', sa.Numeric(precision=16, scale=6), nullable=False),
    sa.Column('vehicle_capacity_qtl', sa.Numeric(precision=16, scale=6), nullable=False),
    sa.ForeignKeyConstraint(['entered_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_farms_owner_id'), 'farms', ['owner_id'], unique=False)
    op.create_table('refresh_tokens',
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('revoked', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('token_hash')
    )
    op.create_table('harvests',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('farm_id', sa.Integer(), nullable=False),
    sa.Column('entered_by', sa.Integer(), nullable=False),
    sa.Column('updated_by', sa.Integer(), nullable=False),
    sa.Column('crop', sa.String(length=100), nullable=False),
    sa.Column('variety', sa.String(length=100), nullable=False),
    sa.Column('grade', sa.String(length=100), nullable=False),
    sa.Column('quantity_qtl', sa.Numeric(precision=16, scale=6), nullable=False),
    sa.Column('entered_value', sa.Numeric(precision=16, scale=6), nullable=False),
    sa.Column('entered_unit', sa.String(length=10), nullable=False),
    sa.Column('harvest_date', sa.Date(), nullable=False),
    sa.Column('latest_sale_date', sa.Date(), nullable=False),
    sa.Column('cash_needed', sa.Numeric(precision=16, scale=2), nullable=True),
    sa.Column('cash_needed_by', sa.Date(), nullable=True),
    sa.ForeignKeyConstraint(['entered_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['farm_id'], ['farms.id'], ),
    sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_harvests_farm_id'), 'harvests', ['farm_id'], unique=False)
    op.create_table('residues',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('harvest_id', sa.Integer(), nullable=False),
    sa.Column('entered_by', sa.Integer(), nullable=False),
    sa.Column('updated_by', sa.Integer(), nullable=False),
    sa.Column('residue_type', sa.String(length=100), nullable=False),
    sa.Column('moisture_percent', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('recoverable_quantity_qtl', sa.Numeric(precision=16, scale=6), nullable=False),
    sa.Column('quantity_kept_qtl', sa.Numeric(precision=16, scale=6), nullable=False),
    sa.ForeignKeyConstraint(['entered_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['harvest_id'], ['harvests.id'], ),
    sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_residues_harvest_id'), 'residues', ['harvest_id'], unique=False)

def downgrade():
    op.drop_index(op.f('ix_residues_harvest_id'), table_name='residues')
    op.drop_table('residues')
    op.drop_index(op.f('ix_harvests_farm_id'), table_name='harvests')
    op.drop_table('harvests')
    op.drop_table('refresh_tokens')
    op.drop_index(op.f('ix_farms_owner_id'), table_name='farms')
    op.drop_table('farms')
    op.drop_table('consents')
    op.drop_table('audit_log')
    op.drop_table('users')
    op.drop_table('roles')
    op.drop_table('otp_states')
