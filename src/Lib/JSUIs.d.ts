// Type definitions for Minecraft Bedrock Edition script APIs
// Project: https://docs.microsoft.com/minecraft/creator/
// Definitions by: Jake Shirley <https://github.com/JakeShirley>
//                 Mike Ammerlaan <https://github.com/mammerla>

/* *****************************************************************************
   Copyright (c) Microsoft Corporation.
   ***************************************************************************** */
/**
 * @beta
 * @packageDocumentation
 * The `@minecraft/server-ui` module contains types for
 * expressing simple dialog-based user experiences.
 *
 *   * {@link ActionFormData} contain a list of buttons with
 * captions and images that can be used for presenting a set of
 * options to a player.
 *   * {@link MessageFormData} are simple two-button message
 * experiences that are functional for Yes/No or OK/Cancel
 * questions.
 *   * {@link ModalFormData} allow for a more flexible
 * "questionnaire-style" list of controls that can be used to
 * take input.
 *
 * Manifest Details
 * ```json
 * {
 *   "module_name": "@minecraft/server-ui",
 *   "version": "2.1.0-beta"
 * }
 * ```
 *
 */
import * as minecraftcommon from '@minecraft/common';
import * as minecraftserver from '@minecraft/server';
export enum FormCancelationReason {
    UserBusy = 'UserBusy',
    UserClosed = 'UserClosed',
}

export enum FormRejectReason {
    MalformedResponse = 'MalformedResponse',
    PlayerQuit = 'PlayerQuit',
    ServerShutdown = 'ServerShutdown',
}

export class ActionFormData {
    /**
     * @remarks
     * Method that sets the body text for the modal form.
     *
     */
    body(bodyText: minecraftserver.RawMessage | string): ActionFormData;
    /**
     * @remarks
     * Adds a button to this form with an icon from a resource
     * pack.
     *
     */
    button(text: minecraftserver.RawMessage | string, iconPath?: string): ActionFormData;
    /**
     * @remarks
     * Adds a section divider to the form.
     *
     */
    divider(): ActionFormData;
    /**
     * @remarks
     * Adds a header to the form.
     *
     * @param text
     * Text to display.
     */
    header(text: minecraftserver.RawMessage | string): ActionFormData;
    /**
     * @remarks
     * Adds a label to the form.
     *
     * @param text
     * Text to display.
     */
    label(text: minecraftserver.RawMessage | string): ActionFormData;
    /**
     * @remarks
     * Creates and shows this modal popup form. Returns
     * asynchronously when the player confirms or cancels the
     * dialog.
     *
     * This function can't be called in restricted-execution mode.
     *
     * @param player
     * Player to show this dialog to.
     * @throws This function can throw errors.
     *
     * {@link minecraftcommon.EngineError}
     *
     * {@link minecraftserver.InvalidEntityError}
     *
     * {@link minecraftserver.RawMessageError}
     */
    show(player: minecraftserver.Player): Promise<ActionFormResponse>;
    /**
     * @remarks
     * This builder method sets the title for the modal dialog.
     *
     */
    title(titleText: minecraftserver.RawMessage | string): ActionFormData;
}

/**
 * Returns data about the player results from a modal action
 * form.
 * @example showActionForm.ts
 * ```typescript
 * import { world, DimensionLocation } from "@minecraft/server";
 * import { ActionFormData, ActionFormResponse } from "@minecraft/server-ui";
 *
 * function showActionForm(log: (message: string, status?: number) => void, targetLocation: DimensionLocation) {
 *   const playerList = world.getPlayers();
 *
 *   if (playerList.length >= 1) {
 *     const form = new ActionFormData()
 *       .title("Test Title")
 *       .body("Body text here!")
 *       .button("btn 1")
 *       .button("btn 2")
 *       .button("btn 3")
 *       .button("btn 4")
 *       .button("btn 5");
 *
 *     form.show(playerList[0]).then((result: ActionFormResponse) => {
 *       if (result.canceled) {
 *         log("Player exited out of the dialog. Note that if the chat window is up, dialogs are automatically canceled.");
 *         return -1;
 *       } else {
 *         log("Your result was: " + result.selection);
 *       }
 *     });
 *   }
 * }
 * ```
 * @example showFavoriteMonth.ts
 * ```typescript
 * import { world, DimensionLocation } from "@minecraft/server";
 * import { ActionFormData, ActionFormResponse } from "@minecraft/server-ui";
 *
 * function showFavoriteMonth(log: (message: string, status?: number) => void, targetLocation: DimensionLocation) {
 *   const players = world.getPlayers();
 *
 *   if (players.length >= 1) {
 *     const form = new ActionFormData()
 *       .title("Months")
 *       .body("Choose your favorite month!")
 *       .button("January")
 *       .button("February")
 *       .button("March")
 *       .button("April")
 *       .button("May");
 *
 *     form.show(players[0]).then((response: ActionFormResponse) => {
 *       if (response.selection === 3) {
 *         log("I like April too!");
 *         return -1;
 *       }
 *     });
 *   }
 * }
 * ```
 */
// @ts-ignore Class inheritance allowed for native defined classes
export class ActionFormResponse extends FormResponse {
    private constructor();
    /**
     * @remarks
     * Returns the index of the button that was pushed.
     *
     */
    readonly selection?: number;
}
/**
 * Base type for a form response.
 */
export class FormResponse {
    private constructor();
    /**
     * @remarks
     * Contains additional details as to why a form was canceled.
     *
     */
    readonly cancelationReason?: FormCancelationReason;
    /**
     * @remarks
     * If true, the form was canceled by the player (e.g., they
     * selected the pop-up X close button).
     *
     */
    readonly canceled: boolean;
}

/**
 * @beta
 * A message that can be sent to the client. This is a subset
 * of the RawMessage type, and is used for UI messages.
 */
export interface UIRawMessage {
    /**
     * @remarks
     * Provides a raw-text equivalent of the current message.
     *
     */
    rawtext?: UIRawMessage[];
    /**
     * @remarks
     * Provides a string literal value to use.
     *
     */
    text?: string;
    /**
     * @remarks
     * Provides a translation token where, if the client has an
     * available resource in the players' language which matches
     * the token, will get translated on the client.
     *
     */
    translate?: string;
    /**
     * @remarks
     * Arguments for the translation token. Can be either an array
     * of strings or UIRawMessage containing an array of raw text
     * objects.
     *
     */
    with?: string[] | UIRawMessage;
}

// @ts-ignore Class inheritance allowed for native defined classes
export class FormRejectError extends Error {
    private constructor();
    /**
     * @remarks
     * This property can be read in early-execution mode.
     *
     */
    readonly reason: FormRejectReason;
}