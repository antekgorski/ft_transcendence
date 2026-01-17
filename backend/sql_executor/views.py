from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db import connection
import traceback


@api_view(['POST'])
def execute_sql(request):
    """Execute SQL query and return results"""
    sql_query = request.data.get('query', '').strip()
    
    if not sql_query:
        return Response(
            {'error': 'No SQL query provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql_query)
            
            # Check if it's a SELECT query (returns data)
            if cursor.description:
                columns = [col[0] for col in cursor.description]
                results = cursor.fetchall()
                
                # Convert results to list of dictionaries
                data = []
                for row in results:
                    data.append(dict(zip(columns, row)))
                
                return Response({
                    'success': True,
                    'columns': columns,
                    'data': data,
                    'row_count': len(data),
                    'query': sql_query
                })
            else:
                # For INSERT, UPDATE, DELETE, etc.
                affected_rows = cursor.rowcount
                return Response({
                    'success': True,
                    'message': f'Query executed successfully. {affected_rows} row(s) affected.',
                    'affected_rows': affected_rows,
                    'query': sql_query
                })
                
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'traceback': traceback.format_exc(),
            'query': sql_query
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def list_tables(request):
    """List all tables in the database"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            """)
            tables = [row[0] for row in cursor.fetchall()]
            
            return Response({
                'success': True,
                'tables': tables,
                'count': len(tables)
            })
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def table_schema(request, table_name):
    """Get schema information for a specific table"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    column_name,
                    data_type,
                    character_maximum_length,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position;
            """, [table_name])
            
            columns = []
            for row in cursor.fetchall():
                columns.append({
                    'column_name': row[0],
                    'data_type': row[1],
                    'max_length': row[2],
                    'nullable': row[3] == 'YES',
                    'default': row[4]
                })
            
            return Response({
                'success': True,
                'table_name': table_name,
                'columns': columns
            })
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
