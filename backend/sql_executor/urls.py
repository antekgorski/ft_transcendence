from django.urls import path
from sql_executor.views import execute_sql, list_tables, table_schema

urlpatterns = [
    path('api/execute/', execute_sql, name='execute_sql'),
    path('api/tables/', list_tables, name='list_tables'),
    path('api/tables/<str:table_name>/schema/', table_schema, name='table_schema'),
]
