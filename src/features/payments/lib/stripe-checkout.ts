import { initPaymentSheet, initStripe, presentPaymentSheet } from "@stripe/stripe-react-native";

/**
 * The Stripe SDK, behind one function.
 *
 * Everything native and stateful about paying lives here: the screens and the
 * domain never import `@stripe/stripe-react-native`, so they stay renderable
 * in jest without mocking a native module, and swapping the provider later
 * means rewriting this file and nothing else.
 */

/** Shown at the top of Stripe's sheet. */
const MERCHANT_NAME = "ServiceHub";

export type CheckoutOutcome =
  /** The customer completed the sheet. The charge may still be settling. */
  | { status: "completed" }
  /** They backed out. Not an error — no message, no red text. */
  | { status: "canceled" }
  | { status: "failed"; message: string };

export type RunCheckoutInput = {
  clientSecret: string;
  publishableKey: string;
};

/**
 * Opens Stripe's payment sheet and resolves with what happened.
 *
 * Never throws: every outcome, including "the SDK blew up", comes back as a
 * value. A rejected promise here would surface as an unhandled rejection
 * inside an `onPress`, which is invisible.
 *
 * **Completing the sheet is not the same as being paid.** It means Stripe
 * accepted the card. The charge is confirmed by the webhook, which the app
 * reads back from our own API — see `useCheckout`.
 */
export async function runCheckout({
  clientSecret,
  publishableKey,
}: RunCheckoutInput): Promise<CheckoutOutcome> {
  try {
    // The key comes from our API rather than being baked into the bundle, so
    // rotating Stripe keys never needs an app release.
    await initStripe({ publishableKey });

    const init = await initPaymentSheet({
      merchantDisplayName: MERCHANT_NAME,
      paymentIntentClientSecret: clientSecret,
      // Lets the sheet reopen with the card already entered if the customer
      // dismisses it by accident.
      allowsDelayedPaymentMethods: false,
    });

    if (init.error) {
      return { status: "failed", message: init.error.message };
    }

    const result = await presentPaymentSheet();

    if (result.error) {
      // Stripe reports a dismissal as an error with this code. Treating it as
      // a failure would show red text to someone who simply changed their
      // mind.
      if (result.error.code === "Canceled") return { status: "canceled" };
      return { status: "failed", message: result.error.message };
    }

    return { status: "completed" };
  } catch (error) {
    console.error("Stripe checkout failed", error);
    return {
      status: "failed",
      message: "No pudimos abrir el pago. Inténtalo de nuevo.",
    };
  }
}
