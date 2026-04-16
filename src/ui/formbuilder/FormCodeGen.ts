/**
 * FormCodeGen — Generates Minecraft Bedrock JSON UI code from visual form elements.
 *
 * Uses the wiki-recommended "modifications" approach for server form compatibility.
 * Properly handles:
 * - form_buttons collection (on stack_panel, NOT panel)
 * - Button mappings for correct index assignment (button.form_button_click)
 * - Bindings for title (#title_text) and body text (#body_text)
 * - Optional nineslice background textures
 * - Anchor, offset, and text alignment properties
 *
 * @see https://wiki.bedrock.dev/json-ui/modifying-server-forms
 * @see https://wiki.bedrock.dev/json-ui/json-ui-documentation
 */

export type FormType = 'action' | 'modal';

export type FormElementType =
  | 'panel' | 'scroll_panel' | 'stack_panel' | 'grid' | 'button' | 'label' | 'header' | 'title'
  | 'body' | 'divider' | 'image' | 'close_button'
  | 'dropdown' | 'slider' | 'toggle' | 'text_input';

export interface FormElement {
  id: string;
  type: FormElementType;
  text: string;
  width: number;
  height: number;
  children: FormElement[];
  color?: [number, number, number];
  texture?: string;
  sliderSteps?: number;
  dropdownOptions?: string[];
  maxLength?: number;
  fontSize?: 'small' | 'normal' | 'large' | 'extra_large';
  // Visual canvas position (editor-only, not in JSON output)
  posX?: number;
  posY?: number;
  // Positioning
  anchorFrom?: string;
  anchorTo?: string;
  offsetX?: number;
  offsetY?: number;
  // Stack / grid layout
  orientation?: 'vertical' | 'horizontal';
  gridColumns?: number;
  gridRows?: number;
  textAlignment?: string;
  // Background texture (nineslice)
  bgTexture?: string;
  ninesliceSize?: number;
  // Bindings
  useBinding?: boolean;
  bindingName?: string;
  // Button specifics
  buttonTexture?: string;
  buttonHoverTexture?: string;
  // Text
  shadow?: boolean;
  // Collection (form_buttons) — makes button.form_button_click send the correct index
  useCollection?: boolean;   // default: true for button type
  collectionName?: string;   // default: "form_buttons"
}

/** Default sizes for each element type */
export const ELEMENT_DEFAULTS: Record<FormElementType, { width: number; height: number; text: string }> = {
  panel:         { width: 200, height: 100, text: '' },
  scroll_panel:  { width: 200, height: 120, text: '' },
  stack_panel:   { width: 200, height: 100, text: '' },
  grid:          { width: 200, height: 100, text: '' },
  title:         { width: 280, height: 26,  text: '' },
  button:        { width: 200, height: 30,  text: 'Button' },
  label:         { width: 200, height: 18,  text: 'Label text' },
  header:        { width: 200, height: 24,  text: 'Header' },
  body:          { width: 200, height: 30,  text: '' },
  divider:       { width: 200, height: 2,   text: '' },
  image:         { width: 64,  height: 64,  text: '' },
  close_button:  { width: 14,  height: 14,  text: '' },
  dropdown:      { width: 200, height: 26,  text: 'Select...' },
  slider:        { width: 200, height: 20,  text: 'Slider' },
  toggle:        { width: 200, height: 22,  text: 'Toggle option' },
  text_input:    { width: 200, height: 26,  text: '' },
};

/** Sanitize a name for use as a JSON UI namespace/identifier */
function sanitize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
}

let elementCounter = 0;
export function createFormElement(type: FormElementType, overrides?: Partial<FormElement>): FormElement {
  const defaults = ELEMENT_DEFAULTS[type];
  return {
    id: `el_${++elementCounter}_${Date.now().toString(36)}`,
    type,
    text: defaults.text,
    width: defaults.width,
    height: defaults.height,
    children: [],
    useBinding: type === 'body',
    // Buttons default to collection mode so button.form_button_click sends
    // the correct index back to the server.
    useCollection: type === 'button' ? true : undefined,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  JSON Generation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Generate the server_form.json base.
 * Uses the "modifications" approach recommended by Bedrock Wiki.
 */
/**
 * Generate server_form.json using the form_chooser / factory approach.
 * Uses a grid with #maximum_grid_items instead of modifications.
 * The server_form.json is the ENTRY POINT shared across all forms;
 * only the new form entry inside form_chooser.controls changes per form.
 *
 * @see template provided by user
 */
export function generateServerFormBase(
  formName: string,
  _formType: FormType
): Record<string, unknown> {
  const safeName = sanitize(formName);
  const formTag  = `${safeName}:`;
  const flagVar  = `$${safeName}_flag`;    // e.g. $my_action_form_flag

  return {
    namespace: 'server_form',

    // form_chooser: top-level panel that selects which form to show.
    // Add one entry here per form. The $flag variable is the tag prefix
    // that the server puts at the start of the form title.
    form_chooser: {
      type: 'panel',
      size: ['100%', '100%'],
      // Flag variable — value must match the prefix the plugin sends
      [flagVar]: formTag,
      controls: [
        {
          form_text_binding_control: {
            type: 'panel',
            bindings: [
              {
                binding_type: 'view',
                source_property_name: '#form_text',
                target_property_name: '#text',
              },
            ],
          },
        },
        {
          // ADD NEW FORMS HERE — copy this block and change the name,
          // $control (namespace.form_root), and $flag variable
          [`${safeName}@long_form_item`]: {
            $control: `${safeName}.form_root`,
            $flag: flagVar,
          },
        },
      ],
    },

    // long_form_item: grid-based renderer that shows / hides via
    // #maximum_grid_items. 0 = hidden, 1 = shown.  Much more efficient
    // than rendering everything and toggling #visible.
    long_form_item: {
      type: 'grid',
      size: ['100%', '100%'],
      grid_rescaling_type: 'horizontal',
      grid_item_template: 'server_form.long_form_control',
      bindings: [
        { binding_name: '#title_text' },
        {
          binding_type: 'view',
          source_property_name: '(1 - (#title_text - $flag = #title_text) * 1)',
          target_property_name: '#maximum_grid_items',
        },
      ],
    },

    long_form_control: {
      type: 'panel',
      size: ['100%', '100%'],
      controls: [{ 'long_form@$control': {} }],
    },

    'third_party_server_screen@common.base_screen': {
      $screen_content: 'server_form.custom_content',
      force_render_below: true,
      render_game_behind: true,
      render_only_when_topmost: true,
      $use_loading_bars: true,
      close_on_player_hurt: true,
      button_mappings: [
        {
          from_button_id: 'button.menu_cancel',
          mapping_type: 'global',
          to_button_id: 'button.menu_exit',
        },
      ],
    },

    custom_content: {
      type: 'panel',
      size: ['100%', '100%'],
      controls: [
        {
          'background@common.screen_background': {
            size: ['200%', '200%'],
            alpha: 0.3,
          },
        },
      ],
      factory: {
        name: 'server_form_factory',
        control_ids: {
          custom_form: 'custom_form.default_form',
          long_form: 'server_form.form_chooser',
        },
      },
    },
  };
}

/**
 * Generate the form namespace file with all user-designed elements.
 */
export function generateFormNamespaceFile(
  formName: string,
  formType: FormType,
  elements: FormElement[]
): Record<string, unknown> {
  const safeName = sanitize(formName);

  const file: Record<string, unknown> = {
    namespace: safeName,
  };

  // Build content controls — all elements are rendered inline
  const contentControls: unknown[] = [];

  for (const element of elements) {
    contentControls.push(generateElementControl(safeName, element, formType));
  }

  // Form content panel
  file[`${safeName}_content`] = {
    type: 'stack_panel',
    orientation: 'vertical',
    size: ['100%', '100%c'],
    anchor_from: 'top_middle',
    anchor_to: 'top_middle',
    controls: contentControls,
  };

  // Form root — entry point instantiated by server_form.long_form_control
  file['form_root'] = {
    type: 'panel',
    size: ['100%', '100%'],
    controls: [
      {
        [`form@${safeName}.${safeName}_content`]: {},
      },
    ],
  };

  return file;
}

/** Generate a single element's JSON UI control definition.
 * @param insidePanel  true when the parent is a `panel` type — children need
 *                     explicit anchor_from/anchor_to/offset to avoid all
 *                     overlapping at the centre (Bedrock JSON UI default).
 */
function generateElementControl(
  namespace: string,
  element: FormElement,
  formType: FormType,
  insidePanel = false
): Record<string, unknown> {
  const elName = `${element.type}_${element.id.slice(0, 10)}`;

  const layoutProps: Record<string, unknown> = {};

  // Anchor — explicit value wins; otherwise default to top_left inside panels
  if (element.anchorFrom) {
    layoutProps.anchor_from = element.anchorFrom;
  } else if (insidePanel) {
    layoutProps.anchor_from = 'top_left';
  }

  if (element.anchorTo) {
    layoutProps.anchor_to = element.anchorTo;
  } else if (insidePanel) {
    layoutProps.anchor_to = 'top_left';
  }

  // Offset — explicit offsetX/offsetY wins; otherwise use canvas posX/posY
  if (element.offsetX !== undefined || element.offsetY !== undefined) {
    layoutProps.offset = [element.offsetX ?? 0, element.offsetY ?? 0];
  } else if (insidePanel && (element.posX !== undefined || element.posY !== undefined)) {
    layoutProps.offset = [element.posX ?? 0, element.posY ?? 0];
  }

  switch (element.type) {
    case 'title': {
      // Title uses the server-provided #title_text binding
      const control: Record<string, unknown> = {
        type: 'label',
        size: [element.width, element.height],
        color: element.color ?? [1, 1, 1],
        font_type: 'MinecraftTen',
        font_size: 'large',
        shadow: element.shadow ?? false,
        text: '#title_text',
        layer: 8,
        ...layoutProps,
        bindings: [{ binding_name: '#title_text' }],
      };
      if (element.textAlignment) control.text_alignment = element.textAlignment;
      return { [elName]: control };
    }

    case 'label': {
      const control: Record<string, unknown> = {
        type: 'label',
        size: [element.width, element.height],
        color: element.color ?? [1, 1, 1],
        font_size: element.fontSize ?? 'normal',
        shadow: element.shadow ?? false,
        layer: 8,
        ...layoutProps,
      };
      if (element.textAlignment) control.text_alignment = element.textAlignment;
      if (element.useBinding && element.bindingName) {
        control.text = element.bindingName;
        control.bindings = [{ binding_name: element.bindingName }];
      } else {
        control.text = element.text || 'Label';
      }
      if (element.bgTexture) return wrapWithBgTexture(elName, element, control, layoutProps);
      return { [elName]: control };
    }

    case 'header': {
      const control: Record<string, unknown> = {
        type: 'label',
        size: [element.width, element.height],
        color: element.color ?? [1, 1, 1],
        font_type: 'MinecraftTen',
        font_size: element.fontSize ?? 'large',
        shadow: element.shadow ?? false,
        layer: 8,
        ...layoutProps,
      };
      if (element.textAlignment) control.text_alignment = element.textAlignment;
      if (element.useBinding && element.bindingName) {
        control.text = element.bindingName;
        control.bindings = [{ binding_name: element.bindingName }];
      } else {
        control.text = element.text || 'Header';
      }
      if (element.bgTexture) return wrapWithBgTexture(elName, element, control, layoutProps);
      return { [elName]: control };
    }

    case 'body': {
      const control: Record<string, unknown> = {
        type: 'label',
        size: [element.width, element.height],
        color: element.color ?? [0.8, 0.8, 0.8],
        font_size: element.fontSize ?? 'normal',
        shadow: element.shadow ?? false,
        text: '#body_text',
        layer: 8,
        ...layoutProps,
        bindings: [{ binding_name: '#body_text' }],
      };
      if (element.textAlignment) control.text_alignment = element.textAlignment;
      if (element.bgTexture) return wrapWithBgTexture(elName, element, control, layoutProps);
      return { [elName]: control };
    }

    case 'divider':
      return {
        [elName]: {
          type: 'image',
          size: [element.width, element.height || 2],
          color: element.color ?? [0.4, 0.4, 0.4],
          texture: 'textures/ui/white_background',
          alpha: 0.5,
          layer: 4,
          ...layoutProps,
        },
      };

    case 'image': {
      const img: Record<string, unknown> = {
        type: 'image',
        size: [element.width, element.height],
        texture: element.texture || 'textures/ui/white_background',
        keep_ratio: true,
        layer: 8,
        ...layoutProps,
      };
      if (element.ninesliceSize) img.nineslice_size = element.ninesliceSize;
      return { [elName]: img };
    }

    case 'panel': {
      // Children of a panel need anchor_from/anchor_to/offset to position
      // themselves — pass insidePanel=true so posX/posY become offset.
      const childControls = element.children.map(c =>
        generateElementControl(namespace, c, formType, true)
      );
      return {
        [elName]: {
          type: 'panel',
          size: [element.width, element.height],
          ...layoutProps,
          ...(childControls.length > 0 ? { controls: childControls } : {}),
        },
      };
    }

    case 'scroll_panel': {
      // Children go inside a stack_panel scroll_content — sequential layout,
      // no absolute positioning needed.
      const childControls = element.children.map(c =>
        generateElementControl(namespace, c, formType, false)
      );
      return {
        [elName]: {
          type: 'scroll_view',
          size: [element.width, element.height],
          // Input button IDs for track interaction
          scrollbar_track_button: 'button.scrollbar_skip_track',
          scrollbar_touch_button: 'button.scrollbar_touch',
          scroll_speed: 20,
          // Named child references — must match the child control names below
          scroll_view_port: 'scroll_view_port',
          scroll_content: 'scroll_content',
          scrollbar_track: 'scrollbar_track',
          scrollbar_box: 'scrollbar_box',
          ...layoutProps,
          controls: [
            {
              // Viewport clips the scrollable content and leaves room for the scrollbar
              scroll_view_port: {
                type: 'panel',
                size: ['100% - 8px', '100%'],
                anchor_from: 'top_left',
                anchor_to: 'top_left',
                clips_children: true,
                controls: [
                  {
                    scroll_content: {
                      type: 'stack_panel',
                      orientation: 'vertical',
                      size: ['100%', '100%c'],
                      controls: childControls,
                    },
                  },
                ],
              },
            },
            {
              // Vertical scrollbar track (8 px wide, full height, right-aligned)
              scrollbar_track: {
                type: 'scrollbar_track',
                size: [8, '100%'],
                anchor_from: 'top_right',
                anchor_to: 'top_right',
              },
            },
            {
              // Scrollbar thumb / box
              scrollbar_box: {
                type: 'scrollbar_box',
                size: [8, 16],
                anchor_from: 'top_right',
                anchor_to: 'top_right',
                default_control: 'default',
                hover_control: 'hover',
                controls: [
                  {
                    default: {
                      type: 'image',
                      size: ['100%', '100%'],
                      texture: 'textures/ui/scrollbar_button',
                    },
                  },
                  {
                    hover: {
                      type: 'image',
                      size: ['100%', '100%'],
                      texture: 'textures/ui/scrollbar_button',
                    },
                  },
                ],
              },
            },
          ],
        },
      };
    }

    case 'stack_panel': {
      // Children are laid out by the stack panel — no absolute positioning.
      const childControls = element.children.map(c =>
        generateElementControl(namespace, c, formType, false)
      );
      const ctrl: Record<string, unknown> = {
        type: 'stack_panel',
        orientation: element.orientation ?? 'vertical',
        size: [element.width, element.height],
        ...layoutProps,
      };
      if (childControls.length > 0) ctrl.controls = childControls;
      return { [elName]: ctrl };
    }

    case 'grid': {
      // Grid handles cell placement — no absolute positioning needed.
      const childControls = element.children.map(c =>
        generateElementControl(namespace, c, formType, false)
      );
      const cols = element.gridColumns ?? 3;
      const rows = element.gridRows ?? 3;
      return {
        [elName]: {
          type: 'grid',
          grid_dimensions: [cols, rows],
          maximum_grid_items: cols * rows,
          size: [element.width, element.height],
          ...layoutProps,
          ...(childControls.length > 0 ? { controls: childControls } : {}),
        },
      };
    }

    case 'close_button':
      return {
        [elName]: {
          type: 'button',
          size: [element.width, element.height],
          anchor_from: 'top_right',
          anchor_to: 'top_right',
          default_control: 'default',
          hover_control: 'hover',
          sound_name: 'random.click',
          controls: [
            { default: { type: 'label', text: '✕', color: [1, 1, 1] } },
            { hover: { type: 'label', text: '✕', color: [1, 0.3, 0.3] } },
          ],
          button_mappings: [
            {
              from_button_id: 'button.menu_select',
              to_button_id: 'button.menu_exit',
              mapping_type: 'pressed',
            },
          ],
        },
      };

    case 'dropdown':
      return {
        [elName]: {
          type: 'dropdown',
          size: [element.width, element.height],
          dropdown_name: `dropdown_${element.id.slice(0, 6)}`,
          dropdown_content_control: 'content',
          dropdown_area: 'button_area',
          layer: 16,
          ...layoutProps,
          controls: [
            {
              button_area: {
                type: 'button',
                size: ['100%', '100%'],
                default_control: 'default',
                hover_control: 'hover',
                controls: [
                  {
                    default: {
                      type: 'panel', size: ['100%', '100%'],
                      controls: [{ label: { type: 'label', text: element.text || 'Select...', color: [1, 1, 1] } }],
                    },
                  },
                  {
                    hover: {
                      type: 'panel', size: ['100%', '100%'],
                      controls: [{ label: { type: 'label', text: element.text || 'Select...', color: [0.54, 0.7, 0.98] } }],
                    },
                  },
                ],
              },
            },
          ],
        },
      };

    case 'slider':
      return {
        [elName]: {
          type: 'slider',
          size: [element.width, element.height],
          slider_name: `slider_${element.id.slice(0, 6)}`,
          slider_direction: 'horizontal',
          slider_steps: element.sliderSteps ?? 10,
          slider_track_button: 'button.menu_select',
          layer: 8,
          ...layoutProps,
        },
      };

    case 'toggle':
      return {
        [elName]: {
          type: 'toggle',
          size: [element.width, element.height],
          toggle_name: `toggle_${element.id.slice(0, 6)}`,
          toggle_default_state: false,
          layer: 8,
          ...layoutProps,
          controls: [
            {
              label: {
                type: 'label',
                text: element.text || 'Toggle',
                color: [1, 1, 1],
                anchor_from: 'left_middle',
                anchor_to: 'left_middle',
                offset: [4, 0],
              },
            },
          ],
        },
      };

    case 'text_input':
      return {
        [elName]: {
          type: 'edit_box',
          size: [element.width, element.height],
          text_box_name: `textbox_${element.id.slice(0, 6)}`,
          max_length: element.maxLength ?? 256,
          text_type: 'ExtendedASCII',
          place_holder_text: element.text || 'Type here...',
          layer: 8,
          ...layoutProps,
        },
      };

    case 'button': {
      const defaultColor = element.color ? [...element.color] : [1, 1, 1];
      const hoverColor = [
        Math.min(1, defaultColor[0] * 1.2),
        Math.min(1, defaultColor[1] * 1.2),
        Math.min(1, defaultColor[2] * 0.8),
      ];
      const makeLabel = (col: number[]) => ({
        type: 'label',
        text: element.text || 'Button',
        color: col,
        font_size: element.fontSize ?? 'normal',
        shadow: element.shadow ?? false,
        ...(element.textAlignment ? { text_alignment: element.textAlignment } : {}),
      });
      const makeState = (tex: string | undefined, col: number[]) => ({
        type: 'panel',
        size: ['100%', '100%'],
        controls: [
          ...(tex ? [{ bg: { type: 'image', size: ['100%', '100%'], texture: tex, ...(element.ninesliceSize ? { nineslice_size: element.ninesliceSize } : {}) } }] : []),
          { text: makeLabel(col) },
        ],
      });

      const useCollection = element.useCollection !== false; // default true
      const collName = element.collectionName ?? 'form_buttons';

      // The actual button control — size is 100% when inside a collection wrapper,
      // or explicit when standalone.
      const buttonBody: Record<string, unknown> = {
        type: 'button',
        size: useCollection ? ['100%', '100%'] : [element.width, element.height],
        $pressed_button_name: 'button.form_button_click',
        default_control: 'default',
        hover_control: 'hover',
        pressed_control: 'pressed',
        sound_name: 'random.click',
        ...(useCollection ? {} : layoutProps),
        button_mappings: [
          { from_button_id: 'button.menu_select', to_button_id: '$pressed_button_name', mapping_type: 'pressed' },
          { from_button_id: 'button.menu_ok',     to_button_id: '$pressed_button_name', mapping_type: 'focused' },
        ],
        controls: [
          { default: makeState(element.buttonTexture, defaultColor) },
          { hover:   makeState(element.buttonHoverTexture ?? element.buttonTexture, hoverColor) },
          { pressed: makeState(element.buttonTexture, defaultColor) },
        ],
        // collection_details tells the engine which collection this button belongs to
        // so button.form_button_click sends the correct index to the server.
        bindings: [
          {
            binding_type: 'collection_details',
            binding_collection_name: collName,
          },
        ],
      };

      if (useCollection) {
        // Wrap in a collection_panel so the engine auto-assigns a sequential
        // collection_index within the form_buttons collection.
        return {
          [`${elName}_col`]: {
            type: 'collection_panel',
            collection_name: collName,
            size: [element.width, element.height],
            ...layoutProps,
            controls: [{ [elName]: buttonBody }],
          },
        };
      }

      // Standalone button (useCollection: false) — no wrapper needed.
      buttonBody.size = [element.width, element.height];
      Object.assign(buttonBody, layoutProps);
      return { [elName]: buttonBody };
    }

    default:
      return {
        [elName]: {
          type: 'panel',
          size: [element.width, element.height],
          ...layoutProps,
        },
      };
  }
}

/** Wrap a text element with a background texture using nineslice */
function wrapWithBgTexture(
  elName: string,
  element: FormElement,
  control: Record<string, unknown>,
  layoutProps: Record<string, unknown>
): Record<string, unknown> {
  const innerControl = { ...control };
  delete innerControl.anchor_from;
  delete innerControl.anchor_to;
  delete innerControl.offset;
  innerControl.layer = 2;

  const bgImage: Record<string, unknown> = {
    type: 'image',
    size: ['100%', '100%'],
    texture: element.bgTexture!,
    layer: 1,
  };
  if (element.ninesliceSize) bgImage.nineslice_size = element.ninesliceSize;

  return {
    [elName]: {
      type: 'panel',
      size: [element.width, element.height],
      ...layoutProps,
      controls: [
        { bg: bgImage },
        { content: innerControl },
      ],
    },
  };
}

/** Generate both files as downloadable content */
export function generateCompleteForm(
  formName: string,
  formType: FormType,
  elements: FormElement[]
): { serverForm: string; formFile: string; formFileName: string } {
  const serverForm = generateServerFormBase(formName, formType);
  const formContent = generateFormNamespaceFile(formName, formType, elements);
  const safeName = sanitize(formName);

  return {
    serverForm: JSON.stringify(serverForm, null, '\t'),
    formFile: JSON.stringify(formContent, null, '\t'),
    formFileName: `ui/${safeName}.json`,
  };
}
