# Tag and Release

### Add Tag

```bash
git tag -a v0.0.1 -m "Initial release of version 0.0.1"

git push origin --tags
```

### Delete Tag

```bash
git tag
git show <tag_name>

## Delete local Tag
git tag -d <tag_name>

## Delete remote Tag
git push origin --delete <tag_name>
```

### Release

```bash
gh release create v0.0.1 --notes "Initial release"
```
