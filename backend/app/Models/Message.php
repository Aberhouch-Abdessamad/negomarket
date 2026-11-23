<?php

namespace App\Models;

use App\Enums\MessageType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Message extends Model
{
    use HasFactory;

    /** Mirrors the database column defaults. */
    protected $attributes = ['message_type' => 'text'];

    protected $fillable = ['message', 'client_message_id'];

    protected function casts(): array
    {
        return [
            'message_type' => MessageType::class,
            'read_at' => 'datetime',
        ];
    }

    public function negotiation(): BelongsTo
    {
        return $this->belongsTo(Negotiation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function offer(): BelongsTo
    {
        return $this->belongsTo(NegotiationOffer::class, 'offer_id');
    }
}
