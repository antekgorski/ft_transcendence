from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User
from game.models import PlayerStats


@receiver(post_save, sender=User)
def create_player_stats(sender, instance, created, **kwargs):
    """
    Signal handler to create PlayerStats when a new user is created
    """
    if created:
        PlayerStats.objects.create(user=instance)
