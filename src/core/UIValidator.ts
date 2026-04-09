import type { UIControlProperties, BindingEntry } from '../types/JsonUITypes';

/** Validation severity */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/** A single validation issue */
export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  path: string;
  suggestion?: string;
}

/** Valid types */
const VALID_TYPES: ReadonlySet<string> = new Set([
  'panel', 'stack_panel', 'grid', 'label', 'image', 'button', 'toggle',
  'slider', 'edit_box', 'dropdown', 'scroll_view', 'scrollbar_box',
  'factory', 'screen', 'custom', 'selection_wheel', 'tab', 'carousel_label',
  'grid_item', 'input_panel',
]);

const VALID_ANCHORS: ReadonlySet<string> = new Set([
  'top_left', 'top_middle', 'top_right',
  'left_middle', 'center', 'right_middle',
  'bottom_left', 'bottom_middle', 'bottom_right',
]);

const VALID_BINDING_TYPES: ReadonlySet<string> = new Set([
  'global', 'collection', 'collection_details', 'view', 'none',
]);

const VALID_ORIENTATIONS: ReadonlySet<string> = new Set(['horizontal', 'vertical']);

const VALID_FONT_SIZES: ReadonlySet<string> = new Set(['small', 'normal', 'large', 'extra_large']);

/** Validates JSON UI controls against the specification */
export class UIValidator {
  /** Validate a single control */
  validateControl(control: UIControlProperties, controlName: string, filePath: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const basePath = `${filePath} > ${controlName}`;

    // Skip variable-references (names with @)
    if (controlName.includes('@')) {
      // Still validate children if any
      this.validateChildren(control, basePath, issues);
      return issues;
    }

    // Type validation
    if (control.type !== undefined) {
      if (typeof control.type === 'string' && !control.type.startsWith('$') && !VALID_TYPES.has(control.type)) {
        issues.push({
          severity: 'error',
          message: `Invalid type "${control.type}"`,
          path: basePath,
          suggestion: `Valid types: ${Array.from(VALID_TYPES).join(', ')}`,
        });
      }
    }

    // Anchor validation
    if (control.anchor_from && typeof control.anchor_from === 'string' && !control.anchor_from.startsWith('$')) {
      if (!VALID_ANCHORS.has(control.anchor_from)) {
        issues.push({
          severity: 'error',
          message: `Invalid anchor_from "${control.anchor_from}"`,
          path: basePath,
          suggestion: `Valid anchors: ${Array.from(VALID_ANCHORS).join(', ')}`,
        });
      }
    }
    if (control.anchor_to && typeof control.anchor_to === 'string' && !control.anchor_to.startsWith('$')) {
      if (!VALID_ANCHORS.has(control.anchor_to)) {
        issues.push({
          severity: 'error',
          message: `Invalid anchor_to "${control.anchor_to}"`,
          path: basePath,
          suggestion: `Valid anchors: ${Array.from(VALID_ANCHORS).join(', ')}`,
        });
      }
    }

    // Orientation validation for stack_panel
    if (control.orientation && typeof control.orientation === 'string' && !control.orientation.startsWith('$')) {
      if (!VALID_ORIENTATIONS.has(control.orientation)) {
        issues.push({
          severity: 'error',
          message: `Invalid orientation "${control.orientation}"`,
          path: basePath,
        });
      }
    }

    // Font size validation
    if (control.font_size && typeof control.font_size === 'string' && !control.font_size.startsWith('$')) {
      if (!VALID_FONT_SIZES.has(control.font_size)) {
        issues.push({
          severity: 'warning',
          message: `Invalid font_size "${control.font_size}"`,
          path: basePath,
        });
      }
    }

    // Bindings validation
    if (control.bindings) {
      this.validateBindings(control.bindings, basePath, issues);
    }

    // Layer warnings
    if (control.layer !== undefined && typeof control.layer === 'number') {
      if (control.layer > 100) {
        issues.push({
          severity: 'warning',
          message: `Layer value ${control.layer} is unusually high`,
          path: basePath,
          suggestion: 'Typical layer values are 0-50. High values may cause rendering issues.',
        });
      }
    }

    // Grid requires grid_item_template or controls
    if (control.type === 'grid') {
      if (!control.grid_item_template && (!control.controls || control.controls.length === 0)) {
        issues.push({
          severity: 'warning',
          message: 'Grid should have grid_item_template or controls',
          path: basePath,
        });
      }
    }

    // Scroll view requires certain sub-controls
    if (control.type === 'scroll_view') {
      if (!control.scrollbar_track_button && !control.scrollbar_touch_button) {
        issues.push({
          severity: 'info',
          message: 'Scroll view has no scrollbar configuration',
          path: basePath,
        });
      }
    }

    // Validate children
    this.validateChildren(control, basePath, issues);

    return issues;
  }

  private validateBindings(bindings: BindingEntry[], basePath: string, issues: ValidationIssue[]): void {
    for (let i = 0; i < bindings.length; i++) {
      const b = bindings[i];
      const bPath = `${basePath} > bindings[${i}]`;

      if (b.binding_type && typeof b.binding_type === 'string' && !b.binding_type.startsWith('$')) {
        if (!VALID_BINDING_TYPES.has(b.binding_type)) {
          issues.push({
            severity: 'error',
            message: `Invalid binding_type "${b.binding_type}"`,
            path: bPath,
            suggestion: `Valid types: ${Array.from(VALID_BINDING_TYPES).join(', ')}`,
          });
        }
      }

      // Collection binding needs collection_name
      if (b.binding_type === 'collection' && !b.binding_collection_name) {
        issues.push({
          severity: 'warning',
          message: 'Collection binding missing binding_collection_name',
          path: bPath,
        });
      }

      // View binding needs source and target
      if (b.binding_type === 'view') {
        if (!b.source_property_name) {
          issues.push({
            severity: 'warning',
            message: 'View binding missing source_property_name',
            path: bPath,
          });
        }
        if (!b.target_property_name) {
          issues.push({
            severity: 'warning',
            message: 'View binding missing target_property_name',
            path: bPath,
          });
        }
      }
    }
  }

  private validateChildren(control: UIControlProperties, basePath: string, issues: ValidationIssue[]): void {
    if (!control.controls) return;
    for (const child of control.controls) {
      for (const [name, props] of Object.entries(child)) {
        issues.push(...this.validateControl(props, name, basePath));
      }
    }
  }

  /** Validate all controls in a file */
  validateFile(fileDef: Record<string, unknown>, filePath: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const [key, value] of Object.entries(fileDef)) {
      if (key === 'namespace') continue;
      if (typeof value === 'object' && value !== null) {
        issues.push(...this.validateControl(value as UIControlProperties, key, filePath));
      }
    }
    return issues;
  }
}
