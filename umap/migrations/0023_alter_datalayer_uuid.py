# Generated by Django 5.1.2 on 2024-10-23 14:28

import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("umap", "0022_add_team"),
    ]

    operations = [
        migrations.AlterField(
            model_name="datalayer",
            name="uuid",
            field=models.UUIDField(
                default=uuid.uuid4, primary_key=True, serialize=False, unique=True
            ),
        ),
    ]
