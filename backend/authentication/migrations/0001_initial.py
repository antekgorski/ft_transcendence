# Generated migration for User model

from django.db import migrations, models
import uuid


class Migration(migrations.Migration):
    """
    Initial migration for User model based on DatabaseDesign.md.
    """

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('username', models.CharField(max_length=150, unique=True)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('password_hash', models.CharField(max_length=255)),
                ('display_name', models.CharField(blank=True, max_length=150, null=True)),
                ('avatar_url', models.URLField(blank=True, max_length=500, null=True)),
                ('language', models.CharField(default='en', max_length=10)),
                ('oauth_provider', models.CharField(blank=True, max_length=50, null=True)),
                ('oauth_id', models.CharField(blank=True, max_length=255, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('notification_preferences', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_login', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'db_table': 'users',
            },
        ),
    ]
