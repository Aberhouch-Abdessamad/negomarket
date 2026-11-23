<?php

namespace App\Services\Media;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Shared image pipeline: re-encodes uploads to WebP (bounded size), which
 * also strips EXIF metadata. Falls back to storing the original when GD/WebP
 * is unavailable on the server.
 */
class ImageProcessor
{
    /**
     * @param  array<string, array{0: int, 1: int}|int>  $variants  name => max edge (int) or [width, height] cover-crop
     * @return array<string, string> name => stored path
     */
    public function store(UploadedFile $file, string $directory, array $variants): array
    {
        $name = (string) Str::uuid();

        if (! extension_loaded('gd') || ! function_exists('imagewebp')) {
            $path = $file->storeAs($directory, "{$name}.{$file->extension()}", 'public');

            return array_fill_keys(array_keys($variants), $path);
        }

        $source = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        if ($source === false) {
            throw ValidationException::withMessages(['image' => 'The file is not a valid image.']);
        }

        $paths = [];
        foreach ($variants as $variant => $size) {
            $path = "{$directory}/{$name}".($variant === 'main' ? '' : "-{$variant}").'.webp';
            Storage::disk('public')->put($path, is_array($size) ? $this->cover($source, $size[0], $size[1]) : $this->fit($source, $size));
            $paths[$variant] = $path;
        }
        imagedestroy($source);

        return $paths;
    }

    private function fit(\GdImage $source, int $maxEdge): string
    {
        $w = imagesx($source);
        $h = imagesy($source);
        $scale = min(1, $maxEdge / max($w, $h));

        return $this->render($source, (int) round($w * $scale), (int) round($h * $scale), 0, 0, $w, $h);
    }

    /** Centre-crop to exactly $tw x $th (or smaller, keeping the ratio, if the source is smaller). */
    private function cover(\GdImage $source, int $tw, int $th): string
    {
        $w = imagesx($source);
        $h = imagesy($source);
        $ratio = $tw / $th;
        [$cw, $ch] = $w / $h > $ratio ? [(int) round($h * $ratio), $h] : [$w, (int) round($w / $ratio)];
        $scale = min(1, $tw / $cw);

        return $this->render($source, (int) round($cw * $scale), (int) round($ch * $scale), (int) (($w - $cw) / 2), (int) (($h - $ch) / 2), $cw, $ch);
    }

    private function render(\GdImage $source, int $dw, int $dh, int $sx, int $sy, int $sw, int $sh): string
    {
        $img = imagecreatetruecolor(max(1, $dw), max(1, $dh));
        imagealphablending($img, false);
        imagesavealpha($img, true);
        imagecopyresampled($img, $source, 0, 0, $sx, $sy, $dw, $dh, $sw, $sh);
        ob_start();
        imagewebp($img, null, 82);
        imagedestroy($img);

        return (string) ob_get_clean();
    }
}
