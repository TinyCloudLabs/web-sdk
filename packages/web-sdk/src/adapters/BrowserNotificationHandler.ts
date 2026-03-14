import { INotificationHandler } from "@tinycloud/sdk-core";
import { SDKErrorHandler, ToastManager, dispatchSDKEvent } from "../notifications";
import type { NotificationConfig } from "../notifications/types";

export class BrowserNotificationHandler implements INotificationHandler {
  private errorHandler: SDKErrorHandler;

  constructor(config?: NotificationConfig) {
    const notificationConfig = {
      popups: config?.popups ?? true,
      throwErrors: config?.throwErrors ?? false,
    };
    this.errorHandler = SDKErrorHandler.getInstance(notificationConfig);

    if (notificationConfig.popups) {
      ToastManager.getInstance({
        position: config?.position,
        duration: config?.duration,
        maxVisible: config?.maxVisible,
      });
      this.errorHandler.setupErrorHandling();
    }
  }

  success(message: string, description?: string): void {
    dispatchSDKEvent.success(message, description);
  }

  warning(message: string, description?: string): void {
    dispatchSDKEvent.warning(message, description);
  }

  error(category: string, message: string, description?: string): void {
    dispatchSDKEvent.error(category, message, description);
  }

  cleanup(): void {
    this.errorHandler.cleanup();
    ToastManager.getInstance().clear();
    dispatchSDKEvent.cleanup();
  }
}
