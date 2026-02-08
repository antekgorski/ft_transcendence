from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def get_user_from_session(session):
    user_id = session.get("user_id")
    if not user_id:
        return AnonymousUser()

    User = get_user_model()
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


class SessionUserAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        session = scope.get("session")
        if session is not None:
            scope["user"] = await get_user_from_session(session)
        return await super().__call__(scope, receive, send)


def SessionUserAuthMiddlewareStack(inner):
    from channels.sessions import SessionMiddlewareStack

    return SessionMiddlewareStack(SessionUserAuthMiddleware(inner))
