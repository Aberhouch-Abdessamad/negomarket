<?php

namespace App\Http\Controllers\Api\V1\Negotiation;

use App\Enums\NegotiationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Negotiation\CancelNegotiationRequest;
use App\Http\Requests\Negotiation\MessageRequest;
use App\Http\Requests\Negotiation\NegotiationOfferRequest;
use App\Http\Requests\Negotiation\StartNegotiationRequest;
use App\Http\Resources\Negotiation\MessageResource;
use App\Http\Resources\Negotiation\NegotiationOfferResource;
use App\Http\Resources\Negotiation\NegotiationResource;
use App\Http\Resources\Negotiation\NegotiationSummaryResource;
use App\Http\Responses\ApiResponse;
use App\Models\Message;
use App\Models\Negotiation;
use App\Models\NegotiationOffer;
use App\Services\Negotiation\MessageService;
use App\Services\Negotiation\NegotiationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Shared negotiation endpoints. The same routes serve customers and sellers;
 * the NegotiationPolicy decides who may see or respond to a thread.
 */
class NegotiationController extends Controller
{
    public function __construct(
        private readonly NegotiationService $negotiations,
        private readonly MessageService $messages,
    ) {}

    /** GET /negotiations */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(NegotiationStatus::class)],
            'role' => ['nullable', Rule::in(['customer', 'seller'])],
            'q' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        $user = $request->user();

        $query = Negotiation::query()
            ->forParticipant($user)
            ->with([
                'product.primaryImage:id,product_id,image_path,thumbnail_path',
                'variant',
                'store:id,name,slug,logo,user_id',
                'customer:id,name,avatar_path',
                'latestOffer.sender:id,name,avatar_path',
                'acceptedOffer.sender:id,name,avatar_path',
                'pendingOffer',
            ])
            ->withCount(['messages as unread_count' => fn ($q) => $q
                ->where('sender_id', '!=', $user->id)
                ->whereNull('read_at')])
            ->when($filters['role'] ?? null, function ($q, string $role) use ($user) {
                $role === 'customer'
                    ? $q->where('customer_id', $user->id)
                    : $q->whereHas('store', fn ($s) => $s->where('user_id', $user->id));
            })
            ->when($filters['status'] ?? null, fn ($q, string $status) => $q->where('status', $status))
            ->when($filters['q'] ?? null, fn ($q, string $term) => $q->whereHas(
                'product',
                fn ($p) => $p->where('name', 'like', '%'.addcslashes($term, '\\%_').'%'),
            ))
            ->orderByDesc('last_activity_at')
            ->orderByDesc('id');

        return ApiResponse::success(
            NegotiationSummaryResource::collection($query->paginate($filters['per_page'] ?? 20)),
        );
    }

    /** POST /negotiations */
    public function store(StartNegotiationRequest $request): JsonResponse
    {
        $negotiation = $this->negotiations->startNegotiation($request->user(), $request->validated());

        return ApiResponse::created(
            new NegotiationResource($this->loadForDetail($negotiation, $request)),
            'Your offer was sent to the seller.',
        );
    }

    /** GET /negotiations/{negotiation} */
    public function show(Request $request, Negotiation $negotiation): JsonResponse
    {
        Gate::authorize('view', $negotiation);

        return ApiResponse::success(new NegotiationResource($this->loadForDetail($negotiation, $request)));
    }

    /** GET /negotiations/unread-count — badge for the navigation bar. */
    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();

        $count = Message::query()
            ->whereNull('read_at')
            ->where('sender_id', '!=', $user->id)
            ->whereHas('negotiation', fn ($q) => $q->forParticipant($user))
            ->count();

        return ApiResponse::success(['unread_count' => $count]);
    }

    /** POST /negotiations/{negotiation}/offers — send a counter-offer. */
    public function storeOffer(NegotiationOfferRequest $request, Negotiation $negotiation): JsonResponse
    {
        Gate::authorize('respond', $negotiation);
        $offer = $this->negotiations->createCounterOffer($request->user(), $negotiation, $request->validated());

        return ApiResponse::created(
            new NegotiationOfferResource($offer->load('sender')),
            'Counter-offer sent.',
        );
    }

    /** POST /negotiations/{negotiation}/offers/{offer}/accept */
    public function accept(Request $request, Negotiation $negotiation, NegotiationOffer $offer): JsonResponse
    {
        Gate::authorize('respond', $negotiation);
        $negotiation = $this->negotiations->acceptOffer($request->user(), $negotiation, $offer);

        return ApiResponse::success(
            new NegotiationResource($this->loadForDetail($negotiation, $request)),
            'Offer accepted. You can now check out at the agreed price.',
        );
    }

    /** POST /negotiations/{negotiation}/offers/{offer}/reject */
    public function reject(Request $request, Negotiation $negotiation, NegotiationOffer $offer): JsonResponse
    {
        Gate::authorize('respond', $negotiation);
        $negotiation = $this->negotiations->rejectOffer($request->user(), $negotiation, $offer);

        return ApiResponse::success(
            new NegotiationResource($this->loadForDetail($negotiation, $request)),
            'Offer rejected.',
        );
    }

    /** POST /negotiations/{negotiation}/offers/{offer}/counter */
    public function counter(NegotiationOfferRequest $request, Negotiation $negotiation, NegotiationOffer $offer): JsonResponse
    {
        Gate::authorize('respond', $negotiation);

        if ((int) $offer->negotiation_id !== (int) $negotiation->id) {
            abort(404);
        }

        $created = $this->negotiations->createCounterOffer($request->user(), $negotiation, $request->validated());

        return ApiResponse::created(
            new NegotiationOfferResource($created->load('sender')),
            'Counter-offer sent.',
        );
    }

    /** POST /negotiations/{negotiation}/cancel */
    public function cancel(CancelNegotiationRequest $request, Negotiation $negotiation): JsonResponse
    {
        Gate::authorize('cancel', $negotiation);
        $negotiation = $this->negotiations->cancelNegotiation($request->user(), $negotiation, $request->validated('reason'));

        return ApiResponse::success(
            new NegotiationResource($this->loadForDetail($negotiation, $request)),
            'Negotiation cancelled.',
        );
    }

    /** GET /negotiations/{negotiation}/messages — marks incoming messages as read. */
    public function messages(Request $request, Negotiation $negotiation): JsonResponse
    {
        Gate::authorize('view', $negotiation);

        $filters = $request->validate([
            'before_id' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'between:1,100'],
        ]);

        $this->messages->markRead($request->user(), $negotiation);

        $messages = $negotiation->messages()
            ->with('sender:id,name,avatar_path')
            ->when($filters['before_id'] ?? null, fn ($q, int $before) => $q->where('id', '<', $before))
            ->reorder()
            ->orderByDesc('id')
            ->limit($filters['per_page'] ?? 50)
            ->get()
            ->reverse()
            ->values();

        return ApiResponse::success(MessageResource::collection($messages));
    }

    /** POST /negotiations/{negotiation}/messages — idempotent per client_message_id. */
    public function sendMessage(MessageRequest $request, Negotiation $negotiation): JsonResponse
    {
        Gate::authorize('message', $negotiation);
        $message = $this->messages->send($request->user(), $negotiation, $request->validated());

        return ApiResponse::created(new MessageResource($message->loadMissing('sender')), 'Message sent.');
    }

    /** POST /negotiations/{negotiation}/read */
    public function markRead(Request $request, Negotiation $negotiation): JsonResponse
    {
        Gate::authorize('view', $negotiation);
        $updated = $this->messages->markRead($request->user(), $negotiation);

        return ApiResponse::success(
            ['updated' => $updated, 'unread_count' => $this->messages->unreadCount($request->user(), $negotiation)],
            'Messages marked as read.',
        );
    }

    private function loadForDetail(Negotiation $negotiation, Request $request): Negotiation
    {
        $negotiation->load([
            'product.primaryImage:id,product_id,image_path,thumbnail_path',
            'variant',
            'store:id,name,slug,logo,user_id',
            'customer:id,name,avatar_path',
            'offers.sender:id,name,avatar_path',
            'acceptedOffer.sender:id,name,avatar_path',
            'pendingOffer.sender:id,name,avatar_path',
        ]);

        $negotiation->unread_count = $this->messages->unreadCount($request->user(), $negotiation);

        return $negotiation;
    }
}
