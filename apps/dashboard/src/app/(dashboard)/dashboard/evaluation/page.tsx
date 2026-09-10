'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Star,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  SlidersHorizontal,
  Filter,
  Calculator,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  getAppraisalPresets,
  getAppraisalDefaults,
  createAppraisalPreset,
  updateAppraisalPreset,
  setDefaultAppraisalPreset,
  deleteAppraisalPreset,
  type AppraisalPreset,
  type AppraisalDefaults,
  type FilterType,
  type AdjustmentType,
} from '@/lib/client-api'

interface FilterFormState {
  filterType: FilterType
  enabled: boolean
  value: number
}

interface AdjustmentFormState {
  adjustmentType: AdjustmentType
  enabled: boolean
  amount: number
  percentage: number
}

interface EditorState {
  id: string | null
  name: string
  description: string
  isDefault: boolean
  filters: FilterFormState[]
  adjustments: AdjustmentFormState[]
}

function buildEditor(preset: AppraisalPreset | null, defaults: AppraisalDefaults): EditorState {
  const filterMap = new Map(preset?.filters.map((f) => [f.filterType, f]) ?? [])
  const adjMap = new Map(preset?.adjustments.map((a) => [a.adjustmentType, a]) ?? [])

  return {
    id: preset?.id ?? null,
    name: preset?.name ?? '',
    description: preset?.description ?? '',
    isDefault: preset?.isDefault ?? false,
    filters: defaults.filters.map((d) => {
      const existing = filterMap.get(d.type)
      return {
        filterType: d.type,
        enabled: existing?.enabled ?? d.enabled,
        value: existing?.value ?? d.value,
      }
    }),
    adjustments: defaults.adjustments.map((d) => {
      const existing = adjMap.get(d.type)
      return {
        adjustmentType: d.type,
        enabled: existing?.enabled ?? d.enabled,
        amount: existing?.amount ?? d.amount,
        percentage: existing?.percentage ?? d.percent ?? 0,
      }
    }),
  }
}

export default function EvaluationPage() {
  const [presets, setPresets] = useState<AppraisalPreset[] | null>(null)
  const [defaults, setDefaults] = useState<AppraisalDefaults | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([getAppraisalPresets(), getAppraisalDefaults()])
      setPresets(p)
      setDefaults(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load presets')
      setPresets([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openEditor = (preset: AppraisalPreset | null) => {
    if (!defaults) return
    setEditor(buildEditor(preset, defaults))
  }

  const handleSave = async () => {
    if (!editor) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: editor.name.trim() || 'Untitled Preset',
        description: editor.description.trim() || undefined,
        isDefault: editor.isDefault,
        filters: editor.filters,
        adjustments: editor.adjustments,
      }
      if (editor.id) {
        await updateAppraisalPreset(editor.id, payload)
      } else {
        await createAppraisalPreset(payload)
      }
      setEditor(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save preset')
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultAppraisalPreset(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set default')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAppraisalPreset(id)
      if (editor?.id === id) setEditor(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete preset')
    }
  }

  const setFilterField = (type: FilterType, patch: Partial<FilterFormState>) =>
    setEditor((s) =>
      s ? { ...s, filters: s.filters.map((f) => (f.filterType === type ? { ...f, ...patch } : f)) } : s
    )

  const setAdjField = (type: AdjustmentType, patch: Partial<AdjustmentFormState>) =>
    setEditor((s) =>
      s
        ? { ...s, adjustments: s.adjustments.map((a) => (a.adjustmentType === type ? { ...a, ...patch } : a)) }
        : s
    )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] text-primary mb-1">
            MODULE // 03 — APPRAISAL RULES ENGINE
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Evaluation Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Appraisal presets control which comparables pass filters and how sale
            prices are adjusted during analysis.
          </p>
        </div>
        <Button
          onClick={() => openEditor(null)}
          disabled={!defaults}
          className="font-mono text-xs tracking-wider"
        >
          <Plus className="w-4 h-4" />
          NEW PRESET
        </Button>
      </div>

      {error && (
        <div className="ui-panel p-4 border-destructive/50">
          <p className="text-sm text-destructive font-mono">{error}</p>
        </div>
      )}

      {/* Preset list */}
      {presets === null ? (
        <div className="ui-panel p-6 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-mono">Loading presets…</span>
        </div>
      ) : presets.length === 0 ? (
        <div className="ui-panel p-6">
          <p className="text-sm text-muted-foreground">
            No appraisal presets yet. Create one to control comp filters and adjustments.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {presets.map((preset) => {
            const enabledFilters = preset.filters.filter((f) => f.enabled).length
            const enabledAdjs = preset.adjustments.filter((a) => a.enabled).length
            return (
              <div
                key={preset.id}
                className="ui-panel p-4 flex items-center gap-4 flex-wrap"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {preset.name}
                    </span>
                    {preset.isDefault && (
                      <span className="flex items-center gap-1 text-[10px] font-mono tracking-wider text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded">
                        <Star className="w-3 h-3" /> DEFAULT
                      </span>
                    )}
                  </div>
                  {preset.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {preset.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 font-mono text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Filter className="w-3 h-3" />
                      {enabledFilters}/{preset.filters.length} filters on
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calculator className="w-3 h-3" />
                      {enabledAdjs}/{preset.adjustments.length} adjustments on
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {!preset.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="font-mono text-[11px]"
                      onClick={() => handleSetDefault(preset.id)}
                    >
                      <Star className="w-3.5 h-3.5" /> SET DEFAULT
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="font-mono text-[11px]"
                    onClick={() => openEditor(preset)}
                  >
                    <Pencil className="w-3.5 h-3.5" /> EDIT
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="font-mono text-[11px] text-destructive hover:text-destructive"
                    onClick={() => handleDelete(preset.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Editor */}
      {editor && defaults && (
        <div className="ui-panel p-6 space-y-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.25em] text-primary">
              {editor.id ? 'EDIT PRESET' : 'NEW PRESET'}
            </p>
            <button
              onClick={() => setEditor(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="font-mono text-xs">Preset name</Label>
              <Input
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                placeholder="e.g. Strict Comp Rules"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs">Description</Label>
              <Input
                value={editor.description}
                onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={editor.isDefault}
              onCheckedChange={(v) => setEditor({ ...editor, isDefault: v })}
            />
            <span className="text-xs font-mono text-muted-foreground">
              Set as default preset
            </span>
          </label>

          {/* Filters */}
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground mb-3 flex items-center gap-2">
              <Filter className="w-3 h-3" /> COMP FILTERS — PASS/FAIL
            </p>
            <div className="space-y-2">
              {editor.filters.map((f) => {
                const meta = defaults.filterLabels[f.filterType]
                return (
                  <div
                    key={f.filterType}
                    className="flex items-center gap-4 p-3 rounded-lg border border-border bg-secondary/30"
                  >
                    <Switch
                      checked={f.enabled}
                      onCheckedChange={(v) => setFilterField(f.filterType, { enabled: v })}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{meta?.label ?? f.filterType}</p>
                      <p className="text-[11px] text-muted-foreground">{meta?.description}</p>
                    </div>
                    {meta?.unit && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={f.value}
                          disabled={!f.enabled}
                          onChange={(e) =>
                            setFilterField(f.filterType, { value: Number(e.target.value) })
                          }
                          className="w-24 h-8 font-mono text-sm text-right"
                        />
                        <span className="text-[11px] font-mono text-muted-foreground w-12">
                          {meta.unit}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Adjustments */}
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground mb-3 flex items-center gap-2">
              <Calculator className="w-3 h-3" /> VALUE ADJUSTMENTS
            </p>
            <div className="space-y-2">
              {editor.adjustments.map((a) => {
                const meta = defaults.adjustmentLabels[a.adjustmentType]
                return (
                  <div
                    key={a.adjustmentType}
                    className="flex items-center gap-4 p-3 rounded-lg border border-border bg-secondary/30"
                  >
                    <Switch
                      checked={a.enabled}
                      disabled={meta?.unavailable}
                      onCheckedChange={(v) => setAdjField(a.adjustmentType, { enabled: v })}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {meta?.label ?? a.adjustmentType}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{meta?.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {meta?.isPercentage ? (
                        <>
                          <Input
                            type="number"
                            value={a.percentage}
                            disabled={!a.enabled}
                            onChange={(e) =>
                              setAdjField(a.adjustmentType, { percentage: Number(e.target.value) })
                            }
                            className="w-20 h-8 font-mono text-sm text-right"
                          />
                          <span className="text-[11px] font-mono text-muted-foreground w-8">%</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] font-mono text-muted-foreground">$</span>
                          <Input
                            type="number"
                            value={a.amount}
                            disabled={!a.enabled || meta?.unavailable}
                            onChange={(e) =>
                              setAdjField(a.adjustmentType, { amount: Number(e.target.value) })
                            }
                            className="w-24 h-8 font-mono text-sm text-right"
                          />
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="font-mono text-xs tracking-wider"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editor.id ? 'SAVE CHANGES' : 'CREATE PRESET'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setEditor(null)}
              className="font-mono text-xs"
            >
              CANCEL
            </Button>
          </div>
        </div>
      )}

      {/* Hint block */}
      <div className="ui-panel p-4 flex items-start gap-3">
        <SlidersHorizontal className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          The <span className="text-foreground font-medium">default preset</span> is applied
          automatically to every analysis run. Filters reject comps that don&apos;t match
          the subject; adjustments reprice the comps that pass.
        </p>
      </div>
    </div>
  )
}
