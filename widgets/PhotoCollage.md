Each user uploads a photo.  The photos start at fullscreen, then shrink into place, drawing out a larger image.

The uploaded photos are stored (in RAM) and become accessable at /${ritName}/img/${imgid}.jpg

## Parameters

  * widget: "PhotoCollage"
  * boxcolor: The box in the svg onto which to put everything
  * saveas": A tag to save the images in, for other widgets to use later
  * bigimage": The image to make from the photos (filename)

## Upward Protocol

The client uploads a photo using the `multipart/form-data` protocol.  The field name for the image is `img` and the filename is `blob`.  It is in jpg format.

## Downward Protocol

  * widget: "PhotoCollage"
  * boxcolor: Same as in Parameters
  * gridsize: The logical size of the entire grid
  * imgs: A list of images to show, each containing:
     * imgid: The id to GET the image with
     * x,y: The vertical and horizontal coordinates the image should
            end in.  Yes, it's backwards.  I blame opencv.
     * r,g,b: Red, Green and Blue to tint the image with.  (This one's
              *not* backwards because I caught opencv in time)
     * size: The size of the image, in logical units
     * sm: Size multiplier, a random amount between 0.9 and 1.0 just
           to keep everything from looking the same
     * thetha: Rotation, in degrees, same reason
