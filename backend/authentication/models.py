import uuid
from django.db import models
from django.contrib.auth.hashers import make_password, check_password


class UserManager(models.Manager):
    """Custom manager for User model with create_user helper."""
    
    def create_user(self, username, email, password=None, **extra_fields):
        """Create and save a user with the given username, email and password."""
        if not username:
            raise ValueError('Username is required')
        if not email:
            raise ValueError('Email is required')
        
        user = self.model(username=username, email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user
    
    def create_superuser(self, username, email, password=None, **extra_fields):
        """Create a superuser (same as create_user in our custom model)."""
        return self.create_user(username, email, password, **extra_fields)


class User(models.Model):
    """
    User model based on DatabaseDesign.md specification.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255)
    display_name = models.CharField(max_length=150, blank=True, null=True)
    avatar_url = models.URLField(max_length=500, blank=True, null=True)
    language = models.CharField(max_length=10, default='en')
    oauth_provider = models.CharField(max_length=50, blank=True, null=True)
    oauth_id = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    notification_preferences = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(blank=True, null=True)

    objects = UserManager()

    class Meta:
        db_table = 'users'

    def set_password(self, raw_password):
        """Hash and set the password"""
        self.password_hash = make_password(raw_password)
    
    def set_unusable_password(self):
        """Mark password as unusable (for OAuth users)"""
        self.password_hash = '!'
    
    def has_usable_password(self):
        """Check if password is usable"""
        return self.password_hash != '!'
    
    def check_password(self, raw_password):
        """Check if password matches the stored hash"""
        return check_password(raw_password, self.password_hash)
    
    @property
    def is_authenticated(self):
        """Always return True for authenticated users (authenticated by session/token)"""
        return True

    def __str__(self):
        return self.username
