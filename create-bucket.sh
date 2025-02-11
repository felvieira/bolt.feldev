#!/bin/sh
echo "Configurando bucket no Minio..."
/usr/bin/mc alias set supabase-minio http://supabase-minio:9000 ${SERVICE_USER_MINIO} ${SERVICE_PASSWORD_MINIO}
/usr/bin/mc mb --ignore-existing supabase-minio/bolt 
echo "Bucket criado (se não existia)!"
