# Generated migration to add original_avatar_url field for storing Intra photos

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0002_alter_user_password_hash_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='original_avatar_url',
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
    ]
