export declare function isSupported(): boolean;
export declare function isPolyfilled(): boolean;
export declare function apply(): void;

declare global {
  interface ToggleEvent {
    readonly source: Element | null;
  }
  interface ToggleEventInit {
    source?: Element | null;
  }
}
