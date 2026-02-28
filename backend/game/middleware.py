from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def get_user_from_session(session):
    print(f"DEBUG: Session keys available in WS middleware: {list(session.keys())}")
    user_id = session.get("user_id")
    if not user_id:
        print("DEBUG: user_id not found in session, returning AnonymousUser")
        return AnonymousUser()

    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
        print(f"DEBUG: Loaded user {user.username} from session for WS")
        return user
    except User.DoesNotExist:
        print("DEBUG: User.DoesNotExist in WS session middleware")
        return AnonymousUser()


class SessionUserAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        session = scope.get("session")
        if session is not None:
            scope["user"] = await get_user_from_session(session)
        else:
            print("DEBUG: scope.get('session') is None in WS middleware!")
        return await super().__call__(scope, receive, send)


def SessionUserAuthMiddlewareStack(inner):
    from channels.sessions import SessionMiddlewareStack

    return SessionMiddlewareStack(SessionUserAuthMiddleware(inner))
