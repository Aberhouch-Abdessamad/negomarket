<?php

namespace App\Http\Responses;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\AbstractPaginator;

/**
 * Single source of truth for the NegoMarket JSON envelope.
 *
 * Success: { "success": true,  "message": string|null, "data": mixed, "meta"?: object }
 * Error:   { "success": false, "message": string,      "errors"?: object }
 */
final class ApiResponse
{
    public static function success(mixed $data = null, ?string $message = null, int $status = 200, array $meta = []): JsonResponse
    {
        if ($data instanceof JsonResource || $data instanceof ResourceCollection) {
            $resolved = $data->response()->getData(true);
            $payload = [
                'success' => true,
                'message' => $message,
                'data' => $resolved['data'] ?? $resolved,
            ];
            $pagination = array_intersect_key($resolved, array_flip(['meta', 'links']));
            if ($pagination || $meta) {
                $payload['meta'] = array_merge($pagination['meta'] ?? [], $meta);
                if (isset($pagination['links'])) {
                    $payload['links'] = $pagination['links'];
                }
            }

            return response()->json($payload, $status);
        }

        if ($data instanceof AbstractPaginator) {
            $array = $data->toArray();
            $payload = [
                'success' => true,
                'message' => $message,
                'data' => $array['data'],
                'meta' => array_merge(array_diff_key($array, ['data' => true]), $meta),
            ];

            return response()->json($payload, $status);
        }

        $payload = ['success' => true, 'message' => $message, 'data' => $data];
        if ($meta) {
            $payload['meta'] = $meta;
        }

        return response()->json($payload, $status);
    }

    public static function created(mixed $data = null, ?string $message = 'Created.'): JsonResponse
    {
        return self::success($data, $message, 201);
    }

    public static function error(string $message, int $status = 400, ?array $errors = null): JsonResponse
    {
        $payload = ['success' => false, 'message' => $message];
        if ($errors !== null) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $status);
    }
}
