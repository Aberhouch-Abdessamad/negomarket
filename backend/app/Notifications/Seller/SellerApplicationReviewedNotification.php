<?php

namespace App\Notifications\Seller;

use App\Enums\StoreApplicationStatus;
use App\Models\StoreApplication;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SellerApplicationReviewedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly StoreApplication $application) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    private function approved(): bool
    {
        return $this->application->status === StoreApplicationStatus::Approved;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim((string) config('app.frontend_url'), '/').($this->approved() ? '/seller' : '/sell');
        $mail = (new MailMessage)->greeting("Hello {$notifiable->name},");

        return $this->approved()
            ? $mail->subject('Your NegoMarket store is approved')
                ->line("Great news: “{$this->application->business_name}” has been approved. You can now set up your store and publish products.")
                ->action('Open seller dashboard', $url)
            : $mail->subject('Your NegoMarket seller application')
                ->line("Unfortunately “{$this->application->business_name}” was not approved.")
                ->line('Reason: '.$this->application->admin_notes)
                ->action('Review and re-apply', $url);
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->approved() ? 'seller_application.approved' : 'seller_application.rejected',
            'title' => $this->approved() ? 'Your store is approved' : 'Seller application not approved',
            'body' => $this->approved()
                ? "“{$this->application->business_name}” is approved. Set up your store and start publishing products."
                : "Reason: {$this->application->admin_notes}",
            'application_id' => $this->application->id,
        ];
    }
}
