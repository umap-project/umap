from django.conf import settings
from umap.models import Team
import logging
log = logging.getLogger(__name__)

def sync_keycloak_groups_to_teams(
    backend,
    user,
    response,
    *args,
    **kwargs
):
    """
    Sync Keycloak groups to existing uMap teams
    using an explicit mapping.
    """

    group_map = getattr(settings, "KEYCLOAK_GROUP_TEAM_MAP", {})
    log.info(f"running keycloak team-mapping")
    if not group_map:
        return
    log.debug(response)
    token_groups = response.get(getattr(settings,"KEYCLOAK_GROUP_TOKEN_CLAIM_NAME","groups"), [])
    log.debug(token_groups)
    if not token_groups:
        return

    teams = []

    for group in token_groups:
        team_slug = group_map.get(group)
        if not team_slug:
            continue
        log.debug(f"team slug {team_slug}")
        try:
            team = Team.objects.get(name=team_slug)
            teams.append(team)
        except Team.DoesNotExist:
            # Fail silently or log — admin decision
            continue

    # Replace or add memberships
    user.teams.add(*teams)
