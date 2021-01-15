import { Directive, OnDestroy, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import { StripeElementsDirective } from './elements.directive';
import { tap, take, switchMap, shareReplay } from 'rxjs/operators';
import { Observable, Subject, Subscription } from 'rxjs';

import type { StripeError, StripeElementType, StripeElementCSSProperties } from '@stripe/stripe-js';
import type { StripeElement, StripeElementOptions, StripeElementChangeEvent } from './generic-types';

/** @dynamic
 * Base element class turning a StripeElement into an Angular component with common features
 * To be used as the base class for all the Stripe related specific components: StripeCard...
 */
@Directive()
export class StripeElementDirective<T extends StripeElementType> implements OnDestroy {

  private element$: Observable<StripeElement<T>>;
  private init$ = new Subject<StripeElementOptions<T>>();
  private _options: StripeElementOptions<T> = {} as any;
  private sub: Subscription;

  /** The StripeElement instance */
  get instance(): StripeElement<T> { return this._instance; }
  private _instance: StripeElement<T>;
  
  /** The latest change value */
  get value(): StripeElementChangeEvent<T> { return this._value; }
  protected _value: StripeElementChangeEvent<T>;

  /** True whenever the element is empty */
  get empty(): boolean { return !this._value || this._value.empty; }

  /** True whenever the element is complete and valid */
  get complete(): boolean { return !!this._value && this._value.complete; }

  /** The StripeError or null */
  get error(): StripeError | null { return !!this._value && this._value.error || null; }

  /** True whenever the element is fully loaded */
  get ready(): boolean { return !!this._ready; }
  private _ready: boolean;
  
  /** True whenever the element is focused */
  get focused(): boolean { return !!this._focused; }
  private _focused: boolean;

  /** True whenever the element is disabled */
  get disabled(): boolean { return false; }

  constructor(elementType: T, elements: StripeElementsDirective, ref: ElementRef<HTMLElement>) {

    // Ensures the element is used within the StripeElement container
    if(!elements) { throw new Error(`
      You're attempting to use a Stripe Element out of a proper StripeElements container.
      Make sure to wrap all the controls within a wm-stripe-elements directive.
    `);}

    // Creates the StripeElement observable
    this.element$ = this.init$.pipe( take(1), switchMap( options => elements.create(elementType, options).pipe(

      tap( elm => {

        // Disposes of the previous element instance, if any
        this._instance && this._instance.destroy();

        // Hooks on the common element's events
        elm.on('ready', () => { this.readyChange.emit(this._ready = true); });
        elm.on('focus', () => { this._focused = true; this.focusChange.emit(); });
        elm.on('blur',  () => { this._focused = false; this.blurChange.emit(); });
        
        // Mounts the element on the DOM
        elm.mount(ref.nativeElement); 

        // Keeps track of the current StripeElement instance
        return this._instance = elm;
      })
    )), shareReplay(1) );

    // Subscribes to the element's observable waiting for the init$ to emit
    this.sub = this.element$.subscribe();
  }

  /** Returns the current options object */
  protected get options(): StripeElementOptions<T> { return this._options || (this._options = {} as any);}

  /** Returns the current option classes object, if any */
  protected get classes(): StripeElementOptions<T>['classes'] { return this._options.classes || (this._options.classes = {}); }
  
  /** Returns the current option style object, if any */
  protected get style(): StripeElementOptions<T>['style'] { return this._options.style || (this._options.style = {}); }

  /** Initialize the StripeElement with the given options */
  protected init(options: StripeElementOptions<T>) {
    // Pushes the initial element options object triggering the element$ Observable to emit
    this.init$.next(options);
  }

  /** Forwards the given call to the StripeElement */
  protected forward(fn: (elm: StripeElement<T>) => void) {

    // Short circuits with the current instance, if any
    if(this.instance) { return fn(this.instance); }
   
    // Resolves the observable to get the latest instance otherwise
    this.element$.pipe(take(1)).subscribe( instance => fn(instance) );
  }

  /** Disables the element whenever possible. Ovverrides this default implementation to forward the status down the Element */
  public disable(_: boolean) {}

  /** Focuses the element */
  public focus() { this.forward( instance => instance.focus() ); }

  /** Blurs the element */
  public blur() { this.forward( instance => instance.blur() ); }

  /** Clears the element */
  public clear() { this.forward( instance => instance.clear() ); }

  /** Class applied to the StripeElement's container. Defaults to StripeElement */
  @Input() set classBase(value: string) { this.classes.base = value;}

  /** The class name to apply when the Element is complete. Defaults to StripeElement--complete */
  @Input() set classComplete(value: string) { this.classes.complete = value; }

  /** The class name to apply when the Element is empty. Defaults to StripeElement--empty */
  @Input() set classEmpty(value: string) { this.classes.empty = value; }

  /** The class name to apply when the Element has focus. Defaults to StripeElement--focus */
  @Input() set classFocus(value: string) { this.classes.focus = value; }

  /** The class name to apply when the Element is invalid. Defaults to StripeElement--invalid */
  @Input() set classInvalid(value: string) { this.classes.invalid = value; }

  /** Emits on value changes */
  @Output('change') valueChange = new EventEmitter<StripeElementChangeEvent<T>>();
  
  /** Emits when fully loaded */
  @Output('ready') readyChange = new EventEmitter<boolean>(true);
  
  /** Emits when focused */
  @Output('focus') focusChange = new EventEmitter<void>();
  
  /** Emits when blurred */
  @Output('blur') blurChange = new EventEmitter<void>();

  /** Emits when escape is pressed */
  @Output('escape') escapeChange = new EventEmitter<void>();

  // Disposes of the element
  ngOnDestroy() {
    this.forward( instance => instance.destroy() );
    this.sub.unsubscribe();
  }
}

export function computeBaseStyle(el: HTMLElement): StripeElementCSSProperties {

 // Computes the element's base style to match the given HTML element
  const computed = window?.getComputedStyle(el);
  return  {
    color: computed.color,
    fontFamily: computed.fontFamily,
    fontSize: computed.fontSize,
    fontStyle: computed.fontStyle,
    fontVariant: computed.fontVariant,
    fontWeight: computed.fontWeight,
    letterSpacing: computed.letterSpacing,
    textDecoration: computed.textDecoration,
    textShadow: computed.textShadow,
    textTransform: computed.textTransform
  };
}