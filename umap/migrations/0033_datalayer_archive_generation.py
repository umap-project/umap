from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("umap", "0032_featurearchive")]
    operations = [
        migrations.AddField(
            model_name="datalayer",
            name="archive_generation",
            field=models.PositiveIntegerField(default=0, editable=False),
        ),
    ]
