export function skillTags(skills) {
  if (!skills) {
    return []
  }

  const seen = new Set()

  return String(skills)
    .split(/[\uFF0C\u3001,]/)
    .map((skill) => skill.trim().toUpperCase())
    .filter(Boolean)
    .filter((skill) => {
      if (seen.has(skill)) {
        return false
      }
      seen.add(skill)
      return true
    })
}

export function isProjectFull(project) {
  return project?.status === 'full' || Number(project?.current_members || 0) >= Number(project?.max_members || 0)
}

export function canApplyToProject(project, user) {
  const currentUserId = user?.student_id || user?.id

  return Boolean(
    user &&
    project?.owner_id !== currentUserId &&
    project?.accepting_applications &&
    !isProjectFull(project) &&
    project?.application_status !== 'pending' &&
    project?.application_status !== 'accepted'
  )
}

export function capacityText(project) {
  return `人數：${Number(project?.current_members || 0)} / ${Number(project?.max_members || 0)}`
}

export function favoriteText(project) {
  return project?.is_favorited ? '取消收藏' : '⭐'
}
