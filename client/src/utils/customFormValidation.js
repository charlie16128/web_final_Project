const FIELD_SELECTOR = 'input:not([type="checkbox"]), select, textarea'

function getField(label) {
  return label.querySelector(FIELD_SELECTOR)
}

function isEmpty(field) {
  return String(field.value || '').trim() === ''
}

function isFieldInvalid(label) {
  const field = getField(label)

  if (!field || field.disabled) {
    return false
  }

  if (label.hasAttribute('data-required') && isEmpty(field)) {
    return true
  }

  return !field.validity.valid
}

function setFieldState(label, invalid) {
  const field = getField(label)

  if (!field) {
    return
  }

  if (invalid) {
    field.setAttribute('aria-invalid', 'true')
    field.classList.add('input-error')
    return
  }

  field.removeAttribute('aria-invalid')
  field.classList.remove('input-error')
}

function validateForm(form) {
  const labels = [...form.querySelectorAll('label[data-error]')]
  let firstInvalidField = null

  for (const label of labels) {
    const field = getField(label)
    const invalid = isFieldInvalid(label)

    setFieldState(label, invalid)

    if (invalid && !firstInvalidField && field) {
      firstInvalidField = field
    }
  }

  if (firstInvalidField) {
    firstInvalidField.focus()
    return false
  }

  return true
}

function refreshField(target) {
  const field = target.closest?.(FIELD_SELECTOR)
  const label = field?.closest('label[data-error]')

  if (!label || field.getAttribute('aria-invalid') !== 'true') {
    return
  }

  setFieldState(label, isFieldInvalid(label))
}

function syncForms(root = document) {
  for (const form of root.querySelectorAll?.('form') || []) {
    if (form.querySelector('label[data-error]')) {
      form.noValidate = true
    }
  }
}

export function installCustomFormValidation() {
  syncForms()

  document.addEventListener('submit', (event) => {
    const form = event.target

    if (!(form instanceof HTMLFormElement) || !form.querySelector('label[data-error]')) {
      return
    }

    form.noValidate = true

    if (!validateForm(form)) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }, true)

  document.addEventListener('input', (event) => refreshField(event.target), true)
  document.addEventListener('change', (event) => refreshField(event.target), true)

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          syncForms(node)
        }
      }
    }
  }).observe(document.body, {
    childList: true,
    subtree: true
  })
}
