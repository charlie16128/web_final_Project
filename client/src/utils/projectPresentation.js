export function skillTags(skills) {
  if (!skills) {
    return []
  }
  return String(skills)
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean)
}

export function isProjectFull(project) {
  return Number(project?.current_members || 0) >= Number(project?.max_members || 0)
}

export function canApplyToProject(project, user) {
  return Boolean(
    user &&
    project?.owner_id !== user.id &&
    project?.accepting_applications &&
    !isProjectFull(project)
  )
}

export function capacityText(project) {
  return `人數：${Number(project?.current_members || 0)} / ${Number(project?.max_members || 0)}`
}

export function favoriteText(project) {
  return project?.is_favorited ? '取消收藏' : '收藏'
}
