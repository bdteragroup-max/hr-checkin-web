from PIL import Image

def process_coins():
    src_path = 'C:/Users/teragroup/.gemini/antigravity-ide/brain/2832c48f-d26c-4e68-bf41-128457687cf7/media__1781927344954.png'
    dest_front = 'public/images/coins/bronze.png'
    dest_back = 'public/images/coins/bronze_back.png'
    
    img = Image.open(src_path)
    w, h = img.size
    
    # Split the image in half horizontally
    left_half = img.crop((0, 0, w // 2, h))
    right_half = img.crop((w // 2, 0, w, h))
    
    def crop_and_resize(image, output_path):
        # Get bounding box of non-transparent area
        bbox = image.getbbox()
        if bbox:
            cropped = image.crop(bbox)
            
            # Make sure it's square by adding padding if necessary or just resizing directly.
            # Medals should be perfectly round so the bounding box is likely a square.
            # Let's check aspect ratio.
            cw, ch = cropped.size
            print(f"Cropped size for {output_path}: {cw}x{ch}")
            
            # Force square
            size = max(cw, ch)
            new_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            new_img.paste(cropped, ((size - cw) // 2, (size - ch) // 2))
            
            # Resize to 254x254
            resized = new_img.resize((254, 254), Image.Resampling.LANCZOS)
            resized.save(output_path)
            print(f"Saved {output_path}")
        else:
            print(f"Could not find bounding box for {output_path}")

    crop_and_resize(left_half, dest_front)
    crop_and_resize(right_half, dest_back)

if __name__ == '__main__':
    process_coins()
