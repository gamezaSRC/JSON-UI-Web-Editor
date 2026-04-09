/** All valid JSON UI control types */
export type UIControlType =
  | 'panel'
  | 'stack_panel'
  | 'grid'
  | 'label'
  | 'image'
  | 'button'
  | 'toggle'
  | 'slider'
  | 'edit_box'
  | 'dropdown'
  | 'scroll_view'
  | 'scrollbar_box'
  | 'factory'
  | 'screen'
  | 'custom'
  | 'selection_wheel'
  | 'tab'
  | 'carousel_label'
  | 'grid_item'
  | 'input_panel';

/** Anchor positions */
export type Anchor =
  | 'top_left' | 'top_middle' | 'top_right'
  | 'left_middle' | 'center' | 'right_middle'
  | 'bottom_left' | 'bottom_middle' | 'bottom_right';

/** Orientation for stack panels */
export type Orientation = 'horizontal' | 'vertical';

/** Font size options */
export type FontSize = 'small' | 'normal' | 'large' | 'extra_large';

/** Font type options */
export type FontType = 'default' | 'smooth' | 'rune' | 'MinecraftTen' | 'unicode';

/** Text alignment */
export type TextAlignment = 'left' | 'center' | 'right';

/** Clip direction */
export type ClipDirection = 'left' | 'right' | 'up' | 'down' | 'center';

/** Binding types */
export type BindingType = 'global' | 'collection' | 'collection_details' | 'view' | 'none';

/** Binding condition */
export type BindingCondition = 'always' | 'visible' | 'once' | 'always_when_visible' | 'visibility_changed' | 'none';

/** Animation easing types */
export type EasingType =
  | 'linear'
  | 'spring'
  | 'in_bounce' | 'out_bounce' | 'in_out_bounce'
  | 'in_expo' | 'out_expo' | 'in_out_expo'
  | 'in_sine' | 'out_sine' | 'in_out_sine'
  | 'in_cubic' | 'out_cubic' | 'in_out_cubic'
  | 'in_back' | 'out_back' | 'in_out_back'
  | 'in_elastic' | 'out_elastic' | 'in_out_elastic'
  | 'in_quart' | 'out_quart' | 'in_out_quart'
  | 'in_quint' | 'out_quint' | 'in_out_quint'
  | 'in_quad' | 'out_quad' | 'in_out_quad'
  | 'in_circ' | 'out_circ' | 'in_out_circ';

/** Animation types */
export type AnimationType = 'alpha' | 'color' | 'size' | 'offset' | 'uv' | 'flip_book' | 'wait' | 'aseprite_flip_book' | 'clip';

/** Renderer types */
export type RendererType =
  | 'hover_text_renderer'
  | '3d_structure_renderer'
  | 'splash_text_renderer'
  | 'ui_holo_cursor'
  | 'trial_time_renderer'
  | 'panorama_renderer'
  | 'actor_portrait_renderer'
  | 'banner_pattern_renderer'
  | 'live_player_renderer'
  | 'web_view_renderer'
  | 'hunger_renderer'
  | 'bubbles_renderer'
  | 'mob_effects_renderer'
  | 'cursor_renderer'
  | 'progress_indicator_renderer'
  | 'camera_renderer'
  | 'horse_jump_renderer'
  | 'armor_renderer'
  | 'horse_heart_renderer'
  | 'heart_renderer'
  | 'hotbar_cooldown_renderer'
  | 'hotbar_renderer'
  | 'hud_player_renderer'
  | 'live_horse_renderer'
  | 'holographic_postrenderer'
  | 'enchanting_book_renderer'
  | 'debug_screen_renderer'
  | 'gradient_renderer'
  | 'paper_doll_renderer'
  | 'name_tag_renderer'
  | 'flying_item_renderer'
  | 'inventory_item_renderer'
  | 'credits_renderer'
  | 'vignette_renderer'
  | 'progress_bar_renderer'
  | 'debug_overlay_renderer'
  | 'background_renderer'
  | 'bundle_renderer'
  | 'editor_gizmo_renderer'
  | 'dash_renderer'
  | 'equipment_preview_renderer'
  | 'editor_volume_highlight_renderer'
  | 'editor_compass_renderer'
  | 'profile_image_renderer'
  | 'locator_bar'
  | 'bundle_tooltip_renderer'
  | 'animated_gif_renderer'
  | 'qr_code_renderer'
  | 'bohr_model_renderer'
  | 'toast_renderer'
  | 'netease_paper_doll_renderer'
  | 'netease_mini_map_renderer';

/** Grid rescaling types */
export type GridRescalingType = 'none' | 'horizontal';

/** Grid fill direction */
export type GridFillDirection = 'none' | 'left_to_right' | 'right_to_left' | 'top_to_bottom' | 'bottom_to_top';

/** Modification operations */
export type ModificationOperation =
  | 'insert_back' | 'insert_front' | 'insert_after' | 'insert_before'
  | 'move_back' | 'move_front' | 'move_after' | 'move_before'
  | 'swap' | 'remove' | 'replace';

/** Text type for edit boxes */
export type TextType = 'ExtendedASCII' | 'IdentifierChars' | 'NumberChars';

/** Size/offset value — can be number, string (e.g. "100%"), or tuple */
export type SizeValue = number | string | [number | string, number | string];

/** Color value as RGB array */
export type ColorValue = [number, number, number] | [number, number, number, number] | string;

/** A single binding entry */
export interface BindingEntry {
  binding_name?: string;
  binding_name_override?: string;
  binding_type?: BindingType;
  binding_collection_name?: string;
  binding_condition?: BindingCondition;
  source_control_name?: string;
  source_property_name?: string;
  target_property_name?: string;
  resolve_sibling_scope?: boolean;
}

/** Factory definition */
export interface FactoryDefinition {
  name: string;
  control_name?: string;
  control_ids?: Record<string, string>;
  factory_variables?: unknown[];
}

/** Button mapping entry */
export interface ButtonMappingEntry {
  from_button_id?: string;
  to_button_id?: string;
  mapping_type?: string;
  scope?: string;
  input_mode_condition?: string;
  ignore_input_scope?: boolean;
  consume_event?: boolean;
  handle_select?: boolean;
  handle_deselect?: boolean;
  button_up_right_of_first_refusal?: boolean;
}

/** Sound entry */
export interface SoundEntry {
  sound_name: string;
  sound_volume?: number;
  sound_pitch?: number;
  min_seconds_between_plays?: number;
}

/** Variable entry */
export interface VariableEntry {
  requires: string;
  [key: string]: unknown;
}

/** Modification entry */
export interface ModificationEntry {
  array_name?: 'controls' | 'bindings' | 'button_mappings';
  control_name?: string;
  operation?: ModificationOperation;
  value?: unknown[] | Record<string, unknown>;
  where?: Record<string, unknown>;
  target?: Record<string, unknown>;
  target_control?: string;
}

/** All properties a UI control can have */
export interface UIControlProperties {
  // Core
  type?: UIControlType;
  controls?: UIControlChild[];
  variables?: VariableEntry[] | VariableEntry;
  modifications?: ModificationEntry[];
  ignored?: boolean;

  // Layout
  anchor_from?: Anchor;
  anchor_to?: Anchor;
  size?: SizeValue;
  max_size?: SizeValue;
  min_size?: SizeValue;
  offset?: SizeValue;
  contained?: boolean;
  draggable?: string;
  follows_cursor?: boolean;
  inherit_max_sibling_width?: boolean;
  inherit_max_sibling_height?: boolean;
  use_anchored_offset?: boolean;

  // Control
  visible?: boolean | string;
  enabled?: boolean | string;
  layer?: number;
  z_order?: number;
  alpha?: number | string;
  propagate_alpha?: boolean;
  clips_children?: boolean;
  allow_clipping?: boolean;
  clip_offset?: SizeValue;
  clip_state_change_event?: string;
  enable_scissor_test?: boolean;
  property_bag?: Record<string, unknown>;
  selected?: boolean;
  use_child_anchors?: boolean;

  // Stack Panel
  orientation?: Orientation;

  // Label
  text?: string;
  color?: ColorValue;
  locked_color?: ColorValue;
  shadow?: boolean;
  font_size?: FontSize;
  font_scale_factor?: number;
  font_type?: FontType;
  backup_font_type?: FontType;
  text_alignment?: TextAlignment;
  alignment?: TextAlignment;
  localize?: boolean;
  line_padding?: number;
  hide_hyphen?: boolean;
  enable_profanity_filter?: boolean;
  locked_alpha?: number;
  notify_on_ellipses?: string[];
  notify_ellipses_sibling?: boolean;
  use_place_holder?: boolean;
  place_holder_text?: string;
  place_holder_text_color?: ColorValue;

  // Sprite/Image
  texture?: string;
  uv?: [number, number];
  uv_size?: [number, number];
  texture_file_system?: string;
  nineslice_size?: number | [number, number, number, number];
  tiled?: boolean | string;
  tiled_scale?: SizeValue;
  clip_direction?: ClipDirection;
  clip_ratio?: number;
  clip_pixelperfect?: boolean;
  pixel_perfect?: boolean;
  keep_ratio?: boolean;
  bilinear?: boolean;
  fill?: boolean;
  grayscale?: boolean;
  force_texture_reload?: boolean;
  base_size?: SizeValue;
  zip_folder?: string;
  allow_debug_missing_texture?: boolean;

  // Sound
  sound_name?: string;
  sound_volume?: number;
  sound_pitch?: number;
  sounds?: SoundEntry[];

  // Button
  default_control?: string;
  hover_control?: string;
  pressed_control?: string;
  locked_control?: string;

  // Toggle
  radio_toggle_group?: boolean;
  toggle_name?: string;
  toggle_default_state?: boolean;
  toggle_group_forced_index?: number;
  toggle_group_default_selected?: number;
  reset_on_focus_lost?: boolean;
  toggle_on_hover?: string;
  toggle_on_button?: string;
  toggle_off_button?: string;
  enable_directional_toggling?: boolean;
  toggle_grid_collection_name?: string;
  checked_control?: string;
  unchecked_control?: string;
  checked_hover_control?: string;
  unchecked_hover_control?: string;
  checked_locked_control?: string;
  unchecked_locked_control?: string;
  checked_locked_hover_control?: string;
  unchecked_locked_hover_control?: string;

  // Slider
  slider_track_button?: string;
  slider_small_decrease_button?: string;
  slider_small_increase_button?: string;
  slider_steps?: number;
  slider_direction?: string;
  slider_timeout?: number;
  slider_collection_name?: string;
  slider_name?: string;
  slider_select_on_hover?: boolean;
  slider_selected_button?: string;
  slider_deselected_button?: string;
  slider_box_control?: string;
  background_control?: string;
  background_hover_control?: string;
  progress_control?: string;
  progress_hover_control?: string;

  // Grid
  grid_dimensions?: [number, number];
  maximum_grid_items?: number;
  grid_dimension_binding?: string;
  grid_rescaling_type?: GridRescalingType;
  grid_fill_direction?: GridFillDirection;
  precached_grid_item_count?: number;
  grid_item_template?: string;
  grid_position?: [number, number];

  // Edit Box
  text_box_name?: string;
  text_edit_box_grid_collection_name?: string;
  constrain_to_rect?: boolean;
  enabled_newline?: boolean;
  text_type?: TextType;
  max_length?: number;
  text_control?: string;
  place_holder_control?: string;
  can_be_deselected?: boolean;
  always_listening?: boolean;
  virtual_keyboard_buffer_control?: string;

  // Scroll View
  scrollbar_track_button?: string;
  scrollbar_touch_button?: string;
  scroll_speed?: number;
  gesture_control_enabled?: boolean;
  always_handle_scrolling?: boolean;
  touch_mode?: boolean;
  scrollbar_box?: string;
  scrollbar_track?: string;
  scroll_view_port?: string;
  scroll_content?: string;
  scroll_box_and_track_panel?: string;
  jump_to_bottom_on_update?: boolean;
  allow_scroll_even_when_content_fits?: boolean;
  scrollbar_always_visible?: boolean;

  // Factory
  factory?: FactoryDefinition;
  control_name?: string;
  control_ids?: Record<string, string>;

  // Data Binding
  bindings?: BindingEntry[];

  // Collection
  collection_name?: string;
  collection_index?: number;

  // Focus
  default_focus_precedence?: number;
  focus_enabled?: boolean;
  focus_wrap_enabled?: boolean;
  focus_magnet_enabled?: boolean;
  focus_identifier?: string;
  focus_change_down?: string;
  focus_change_up?: string;
  focus_change_left?: string;
  focus_change_right?: string;
  focus_container?: boolean;
  use_last_focus?: boolean;

  // Input
  button_mappings?: ButtonMappingEntry[];
  modal?: boolean;
  inline_modal?: boolean;
  always_listen_to_input?: boolean;
  always_handle_pointer?: boolean;
  always_handle_controller_direction?: boolean;
  hover_enabled?: boolean;
  prevent_touch_input?: boolean;
  consume_event?: boolean;
  consume_hover_events?: boolean;

  // Screen
  render_only_when_topmost?: boolean;
  screen_not_flushable?: boolean;
  always_accepts_input?: boolean;
  render_game_behind?: boolean;
  absorbs_input?: boolean;
  is_showing_menu?: boolean;
  is_modal?: boolean;
  should_steal_mouse?: boolean;
  low_frequency_rendering?: boolean;
  screen_draws_last?: boolean;
  force_render_below?: boolean;
  close_on_player_hurt?: boolean;
  cache_screen?: boolean;
  gamepad_cursor?: boolean;

  // Custom Renderer
  renderer?: RendererType;
  camera_tilt_degrees?: number;
  starting_rotation?: number;
  use_selected_skin?: boolean;
  use_uuid?: boolean;
  use_skin_gui_scale?: boolean;
  use_player_paperdoll?: boolean;
  rotation?: string;
  animation_looped?: boolean;

  // Gradient
  gradient_direction?: string;
  color1?: ColorValue;
  color2?: ColorValue;

  // Animations
  anims?: string[];
  disable_anim_fast_forward?: boolean;
  animation_reset_name?: string;

  // Animation element props
  anim_type?: AnimationType;
  duration?: number;
  next?: string;
  destroy_at_end?: string;
  play_event?: string;
  end_event?: string;
  start_event?: string;
  reset_event?: string;
  easing?: EasingType;
  from?: number | SizeValue | ColorValue;
  to?: number | SizeValue | ColorValue;
  initial_uv?: [number, number];
  fps?: number;
  frame_count?: number;
  frame_step?: number;
  reversible?: boolean;
  resettable?: boolean;
  scale_from_starting_alpha?: boolean;
  activated?: boolean;
  looping?: boolean;

  // TTS
  tts_name?: string;
  tts_control_header?: string;
  tts_section_header?: string;
  tts_control_type_order_priority?: number;
  tts_index_priority?: number;
  tts_toggle_on?: string;
  tts_toggle_off?: string;
  tts_override_control_value?: string;
  tts_inherit_siblings?: boolean;
  tts_skip_message?: boolean;

  // Dropdown
  dropdown_name?: string;
  dropdown_content_control?: string;
  dropdown_area?: string;

  // Selection Wheel
  inner_radius?: number;
  outer_radius?: number;
  state_controls?: string[];
  slice_count?: number;
  button_name?: string;
  iterate_left_button_name?: string;
  iterate_right_button_name?: string;
  initial_button_slice?: number;
  select_button_name?: string;
  hover_button_name?: string;

  // Variables ($ prefix)
  [key: `$${string}`]: unknown;
}

/** A child control entry: { name: UIControlProperties } or { "name@ref": UIControlProperties } */
export type UIControlChild = Record<string, UIControlProperties>;

/** A complete JSON UI file: namespace + named controls */
export interface UIFileDefinition {
  namespace: string;
  [controlName: string]: UIControlProperties | string;
}

/** Global variables file */
export type GlobalVariables = Record<string, unknown>;

/** UI Defs file */
export interface UIDefsFile {
  ui_defs: string[];
}

/** Texture asset reference */
export interface TextureAsset {
  id: string;
  name: string;
  path: string;
  data: string; // base64 data URL
  width: number;
  height: number;
  nineslice?: NinesliceConfig;
}

/** Nineslice configuration */
export interface NinesliceConfig {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** A complete project */
export interface JsonUIProject {
  name: string;
  files: Map<string, UIFileDefinition>;
  globalVariables: GlobalVariables;
  uiDefs: UIDefsFile;
  textures: Map<string, TextureAsset>;
}
