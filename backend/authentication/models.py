import uuid
import random
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.contrib.auth.hashers import make_password, check_password
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile
import os



class UserManager(BaseUserManager):
    """Manager for custom User model."""
    
    def create_user(self, username, email, password=None, **extra_fields):
        """Create and return a regular user."""
        if not username:
            raise ValueError('Username is required')
        if not email:
            raise ValueError('Email is required')
        
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, username, email, password=None, **extra_fields):
        """Create and return a superuser."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        
        return self.create_user(username, email, password, **extra_fields)


class User(AbstractBaseUser):
    """
    User model based on DatabaseDesign.md specification.
    """
    # Default avatar choices - relative paths in media folder
    AVATAR_CHOICES = [
        'avatars/avatar_1.jpg',
        'avatars/avatar_2.jpg',
        'avatars/avatar_3.jpg',
        'avatars/avatar_4.jpg',
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=255, db_column='password_hash')
    display_name = models.CharField(max_length=150, blank=True, null=True)
    avatar_url = models.ImageField(upload_to='avatars/', max_length=500, blank=True, null=True)
    custom_avatar_url = models.ImageField(upload_to='avatars/', max_length=500, blank=True, null=True)  # Stores local path to custom uploaded avatar
    intra_avatar_url = models.ImageField(upload_to='avatars/', max_length=500, blank=True, null=True)  # Stores local path to downloaded Intra photo

    language = models.CharField(max_length=10, default='en')
    oauth_provider = models.CharField(max_length=50, blank=True, null=True)
    oauth_id = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    notification_preferences = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(blank=True, null=True)

    objects = UserManager()
    
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        db_table = 'users'

    def save(self, *args, **kwargs):
        """Override save to optimize images"""
        # Check if we should skip optimization (e.g. only updating last_login)
        update_fields = kwargs.get('update_fields')
        
        should_optimize = True
        if update_fields:
            # If update_fields is present, only optimize if we are updating avatar fields
            should_optimize = any(field in update_fields for field in ['avatar_url', 'intra_avatar_url', 'custom_avatar_url'])
            
        if should_optimize:
            # Optimize avatar_url
            if self.avatar_url and (not update_fields or 'avatar_url' in update_fields):
                self._optimize_image(self.avatar_url)
            
            # Optimize intra_avatar_url
            if self.intra_avatar_url and (not update_fields or 'intra_avatar_url' in update_fields):
                self._optimize_image(self.intra_avatar_url)
                
            # Optimize custom_avatar_url
            if self.custom_avatar_url and (not update_fields or 'custom_avatar_url' in update_fields):
                self._optimize_image(self.custom_avatar_url)
            
        super().save(*args, **kwargs)

    def _optimize_image(self, image_field):
        """Resize and compress image field"""
        try:
            # Check if image has already been processed (optional: check existence)
            # Opening the image with Pillow
            img = Image.open(image_field)
            
            # Convert to RGB if needed (e.g. for PNGs with alpha channel)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize if larger than 500x500
            if img.height > 500 or img.width > 500:
                output_size = (500, 500)
                img.thumbnail(output_size)
                
                # Save back to memory
                output = BytesIO()
                img.save(output, format='JPEG', quality=85)
                output.seek(0)
                
                # Update the file field
                # Note: We need to be careful not to trigger infinite loop if we were calling save() again, 
                # but here we are just modifying the file content before the actual save.
                # However, Django's ImageField save logic is complex. 
                # Better approach: modify the file object in memory before it gets saved.
                
                # Assign the optimized content back to the file field attributes
                image_field.file = ContentFile(output.read())
        except Exception as e:
            # If optimization fails (e.g. file not found or not an image), just pass
            # print(f"Image optimization failed: {e}")
            pass

    def set_password(self, raw_password):
        """Hash and set the password"""
        self.password = make_password(raw_password)
    
    def set_unusable_password(self):
        """Mark password as unusable (for OAuth users)"""
        self.password = '!'
    
    def has_usable_password(self):
        """Check if password is usable"""
        return self.password != '!'
    
    def check_password(self, raw_password):
        """Check if password matches the stored hash"""
        return check_password(raw_password, self.password)
    
    def assign_random_default_avatar(self):
        """Assign a random default avatar URL to the user"""
        default_avatar = random.choice(self.AVATAR_CHOICES)
        self.avatar_url = default_avatar
    
    def get_default_avatar_url(self, avatar_index):
        """Get the URL for a specific default avatar (1-4)"""
        if 1 <= avatar_index <= 4:
            return f"avatars/avatar_{avatar_index}.jpg"
        return None
    
    @property
    def is_authenticated(self):
        """Always return True for authenticated users (authenticated by session/token)"""
        return True
    
    def has_perm(self, perm, obj=None):
        """Does the user have a specific permission?"""
        return self.is_superuser
    
    def has_module_perms(self, app_label):
        """Does the user have permissions to view the app `app_label`?"""
        return self.is_superuser

    def __str__(self):
        return self.username
