Agents are welcomed but we need to talk first.

This project is maintained by humans, so contributions must respect their time and attention.

We accept agent-made contributions as soon as a human contributor is involved and understand what has been done.

Your PR must respect these conditions:

* smaller than 300-ish LOC (excluding docs) until you are a veteran contributor or the issue has been discussed and approved by a member of the umap-project organization
* the description must be concise, like 2 paragraphs and contain a use-case
* if the fix is related to a graphical element, we need a screenshot before/after
* NEVER include translations, these are done in transifex (do not even run `just messages`)
* try to stack atomic PRs instead of making a huge one, one feature per PR, refactor in a dedicated commit
* add at least one test, if possible with Playwright when it affects the frontend, which evaluates the functional result, not the chosen implementation

A good PR example is #3554 associated with #3552 issue.
