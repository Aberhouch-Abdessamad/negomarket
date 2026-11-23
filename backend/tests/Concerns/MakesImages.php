<?php

namespace Tests\Concerns;

use Illuminate\Http\UploadedFile;

/**
 * GD-free image fixtures.
 *
 * `UploadedFile::fake()->image()` needs the GD extension, which is not always
 * available (for example on locked-down Windows PHP builds). These helpers
 * produce a valid RGB PNG using only zlib, so upload validation and the
 * image pipeline can still be tested.
 */
trait MakesImages
{
    /** A real PNG of exactly $width x $height bytes. */
    protected function png(int $width, int $height): string
    {
        $raw = '';
        $row = "\x00".str_repeat("\x00", $width * 3);
        for ($y = 0; $y < $height; $y++) {
            $raw .= $row;
        }

        return "\x89PNG\r\n\x1a\n"
            .$this->pngChunk('IHDR', pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0))
            .$this->pngChunk('IDAT', (string) gzcompress($raw, 6))
            .$this->pngChunk('IEND', '');
    }

    /** Build an uploaded image fixture. The content is always a PNG; only the name differs. */
    protected function image(string $name, int $width, int $height, int $paddingKilobytes = 0): UploadedFile
    {
        $bytes = $this->png($width, $height).($paddingKilobytes > 0 ? str_repeat("\0", $paddingKilobytes * 1024) : '');

        return UploadedFile::fake()->createWithContent($name, $bytes);
    }

    private function pngChunk(string $type, string $data): string
    {
        return pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));
    }
}
