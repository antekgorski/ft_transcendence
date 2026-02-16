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
        """Override save to optimize images and clean up old files"""
        # Check if we should skip optimization (e.g. only updating last_login)
        update_fields = kwargs.get('update_fields')
        
        old_avatar = None
        old_intra = None
        old_custom = None

        # Check for existing instance to compare fields
        if self.pk:
            try:
                old_instance = User.objects.get(pk=self.pk)
                old_avatar = old_instance.avatar_url
                old_intra = old_instance.intra_avatar_url
                old_custom = old_instance.custom_avatar_url
                
                # Helper to delete old file if changed
                self._delete_old_file(old_instance.avatar_url, self.avatar_url)
                self._delete_old_file(old_instance.intra_avatar_url, self.intra_avatar_url)
                self._delete_old_file(old_instance.custom_avatar_url, self.custom_avatar_url)
            except User.DoesNotExist:
                pass

        should_optimize = True
        if update_fields:
            # If update_fields is present, only optimize if we are updating avatar fields
            should_optimize = any(field in update_fields for field in ['avatar_url', 'intra_avatar_url', 'custom_avatar_url'])
            
        if should_optimize:
            # Optimize avatar_url
            if self.avatar_url and (not update_fields or 'avatar_url' in update_fields):
                # Only optimize if it's a new upload (different from old) or if it's a new user
                if not self.pk or self.avatar_url != old_avatar:
                    # Skip if avatar_url is just a reference to intra or custom (already optimized)
                    is_reference = False
                    if self.intra_avatar_url and self.avatar_url.name == self.intra_avatar_url.name:
                        is_reference = True
                    if self.custom_avatar_url and self.avatar_url.name == self.custom_avatar_url.name:
                        is_reference = True
                    if not is_reference:
                        self._optimize_image(self.avatar_url, 'avatar')
            
            # Optimize intra_avatar_url
            if self.intra_avatar_url and (not update_fields or 'intra_avatar_url' in update_fields):
                if not self.pk or self.intra_avatar_url != old_intra:
                    self._optimize_image(self.intra_avatar_url, 'intra')
                
            # Optimize custom_avatar_url
            if self.custom_avatar_url and (not update_fields or 'custom_avatar_url' in update_fields):
                if not self.pk or self.custom_avatar_url != old_custom:
                    self._optimize_image(self.custom_avatar_url, 'custom')
            
        super().save(*args, **kwargs)

    def _delete_old_file(self, old_file, new_file):
        """Delete old file if it changed and is not referenced by other fields"""
        if old_file and old_file != new_file:
            old_name = old_file.name
            if not old_name:
                return

            # Check if it's one of the default avatars
            is_default = any(str(old_name).endswith(choice) for choice in self.AVATAR_CHOICES)
            if is_default:
                return

            # Check if file is still referenced by other fields on the NEW instance
            # We compare names to be safe.
            
            # Check active avatar
            if self.avatar_url and self.avatar_url.name == old_name:
                return
            # Check intra avatar
            if self.intra_avatar_url and self.intra_avatar_url.name == old_name:
                return
            # Check custom avatar
            if self.custom_avatar_url and self.custom_avatar_url.name == old_name:
                return

            try:
                # Use storage backend to delete
                if old_file.storage.exists(old_name):
                    old_file.storage.delete(old_name)
            except Exception:
                pass

    def _optimize_image(self, image_field, suffix='avatar'):
        """Resize and compress image field"""
        try:
            # Capture initial name to clean up later if it's an orphan/temp file
            initial_name = image_field.name

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
            
            # Save back to memory as JPEG
            output = BytesIO()
            img.save(output, format='JPEG', quality=85)
            output.seek(0)
            
            # Generate a new unique filename with user ID and suffix
            # Format: {user_id}_{suffix}_{random_hex}.jpg
            ext = '.jpg'
            random_hex = uuid.uuid4().hex[:8]
            user_id_str = str(self.id) if self.id else 'new_user'
            new_filename = f"{user_id_str}_{suffix}_{random_hex}{ext}"
            
            # Save the optimized content
            # We use save=False to avoid infinite recursion of model.save()
            image_field.save(new_filename, ContentFile(output.read()), save=False)

            # CLEANUP: Delete the initial file if it exists and is different from the new one
            # This handles cases where the unoptimized source file was saved to disk (orphaned)
            if initial_name and initial_name != image_field.name:
                is_default = any(str(initial_name).endswith(choice) for choice in self.AVATAR_CHOICES)
                if is_default:
                    pass  # Never delete defaults
                else:
                    # Check if file is still referenced by another avatar field
                    still_referenced = False
                    if self.avatar_url and self.avatar_url.name == initial_name:
                        still_referenced = True
                    if self.intra_avatar_url and self.intra_avatar_url.name == initial_name:
                        still_referenced = True
                    if self.custom_avatar_url and self.custom_avatar_url.name == initial_name:
                        still_referenced = True
                    if not still_referenced:
                        try:
                            if image_field.storage.exists(initial_name):
                                image_field.storage.delete(initial_name)
                        except Exception:
                            pass
                        
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
