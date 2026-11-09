import * as DOMUtils from '../domutils.js'
import { resolveTiming } from '../feature_timing.js'
import { translate } from '../i18n.js'
import { MutatingForm } from './builder.js'

const TIMING_KEY = 'properties._umap_options.timing'

export class FeatureTimingForm extends MutatingForm {
  constructor(...args) {
    super(...args)
    // A save or preset click must observe the value that is already on screen.
    this.debounce = false
  }

  get timingKey() {
    return this.properties.layerDefaults ? 'properties.timingDefaults' : TIMING_KEY
  }

  get timing() {
    return this.properties.layerDefaults
      ? this.obj.properties.timingDefaults
      : this.obj.properties._umap_options.timing
  }

  getter(helper) {
    return this.timing?.[this.getName(helper.field)]
  }

  setter(helper, value) {
    const key = this.getName(helper.field)
    const previous = this.timing
    if (previous?.[key] === value) return
    const timing = { ...previous }
    if (value === undefined) delete timing[key]
    else timing[key] = value
    if (key === 'deleteAfter' && value !== undefined) {
      delete timing.deleteOn
      this.form.querySelector('input[name=deleteOn]').value = ''
    }
    if (key === 'deleteOn' && value) {
      delete timing.deleteAfter
      this.form.querySelector('input[name=deleteAfter]').value = ''
    }
    // The journal only updates paths whose parent object exists on every peer.
    // Send the schedule as one value, including on its first creation and undo.
    if (this.properties.layerDefaults) this.obj.properties.timingDefaults = timing
    else this.obj.setter(this.timingKey, timing)
    this.obj.render([this.timingKey], this)
    this.obj.journal.update(this.timingKey, timing, previous)
    this.updateStatus?.()
  }
}

export async function appendTimingFields(obj, container, layerDefaults = false) {
  const fieldset = DOMUtils.createFieldset(container, translate('Feature timing'))
  const prefix = layerDefaults ? 'properties.timingDefaults' : TIMING_KEY
  const builder = new FeatureTimingForm(
    obj,
    [
      [`${prefix}.enabled`, { handler: 'Switch', label: translate('Enable timing') }],
      [
        `${prefix}.hideOn`,
        {
          handler: 'Input',
          label: translate('Hide from (optional)'),
          placeholder: '2026-11-15 / 15.11.2026 / {Ende}',
          helpText: translate(
            'Use a date or a field reference such as {Ende}. Empty referenced fields pause the schedule.'
          ),
        },
      ],
      [
        `${prefix}.expiryAction`,
        {
          handler: 'Select',
          label: translate('At expiration'),
          selectOptions: [
            ['delete', translate('Delete')],
            ['move', translate('Move to layer (keep)')],
          ],
        },
      ],
      [
        `${prefix}.archiveLayer`,
        {
          handler: 'Select',
          label: translate('Destination layer'),
          getOptions: () => {
            const source = layerDefaults ? obj : obj.datalayer
            return [
              ['', '—'],
              ...obj.app.layers.tree
                .filter(
                  (layer) =>
                    layer !== source &&
                    layer.createdOnServer &&
                    !layer.group &&
                    !layer.isDataReadOnly()
                )
                .map((layer) => [layer.id, layer.getName(true)]),
            ]
          },
          helpText: translate(
            'Choose a saved local layer with compatible edit permissions. Moving disables timing. Older versions remain; reload to see background changes.'
          ),
        },
      ],
      [
        `${prefix}.deleteOn`,
        {
          handler: 'Input',
          label: translate('Delete on'),
          placeholder: '2027-02-15 / {Ende}',
          helpText: translate(
            'Required for automatic cleanup. Dates start at midnight UTC. Hidden features remain accessible; older versions and backups may retain deleted features.'
          ),
        },
      ],
      [
        `${prefix}.deleteAfter`,
        {
          handler: 'TimingDelayInput',
          label: translate('Delete after hiding'),
          min: 1,
          max: 36500,
          step: 1,
          helpText: translate(
            'Enter a delay instead of Delete on. Calendar months end on the last available day.'
          ),
        },
      ],
      [
        `${prefix}.deleteUnit`,
        {
          handler: 'Select',
          label: translate('Unit'),
          selectOptions: [
            ['days', translate('Days')],
            ['months', translate('Months')],
          ],
        },
      ],
    ],
    { layerDefaults }
  )
  const form = await builder.build()
  const status = document.createElement('small')
  status.className = 'help-text timing-status'
  status.setAttribute('role', 'status')
  builder.updateStatus = () => {
    const timing = builder.timing
    const calculated = timing?.deleteAfter !== undefined
    const moving = timing?.expiryAction === 'move'
    const expiryLabel = moving ? translate('Move on') : translate('Delete on')
    form.querySelector('.umap-field-deleteOn label').firstChild.textContent =
      expiryLabel
    form.querySelector('.umap-field-deleteAfter label').firstChild.textContent = moving
      ? translate('Move after hiding')
      : translate('Delete after hiding')
    form.querySelector('.umap-field-archiveLayer').hidden = !moving
    form.querySelector('select[name=archiveLayer]').required = Boolean(
      timing?.enabled && moving
    )
    const deletion = form.querySelector('input[name=deleteOn]')
    deletion.required = Boolean(timing?.enabled && !calculated)
    // The absolute-date requirement does not apply when a delay is set.
    form.querySelector('.umap-field-deleteOn .help-text').hidden = calculated || moving
    if (layerDefaults) {
      status.textContent = translate(
        'Applied to newly drawn features only. Existing features keep their own schedule.'
      )
    } else if (timing?.enabled) {
      try {
        const resolved = resolveTiming(timing, obj.properties)
        const format = (value) =>
          value === null ? '—' : new Date(value).toISOString().slice(0, 10)
        status.textContent = `${translate('Hide from (optional)')}: ${format(resolved.hide)} · ${expiryLabel}: ${format(resolved.delete)} (UTC)`
      } catch {
        status.textContent = translate('Invalid calendar date.')
      }
    } else status.textContent = ''
  }
  if (!layerDefaults) obj.updateTimingStatus = builder.updateStatus
  builder.updateStatus()
  fieldset.append(form, status)
  if (!layerDefaults) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = translate('Use for new features in this layer')
    button.addEventListener('click', () => {
      const layer = obj.datalayer
      const previous = layer.properties.timingDefaults
      const timing = JSON.parse(JSON.stringify(builder.timing || { enabled: false }))
      layer.properties.timingDefaults = timing
      layer.render(['properties.timingDefaults'])
      layer.journal.update('properties.timingDefaults', timing, previous)
      status.textContent = translate(
        'Applied to newly drawn features only. Existing features keep their own schedule.'
      )
    })
    fieldset.appendChild(button)
  }
}
