import numpy as np
import torch
from PIL import Image
from diffusers.pipelines.controlnet.pipeline_controlnet import StableDiffusionControlNetPipeline
from diffusers.models.controlnets.controlnet import ControlNetModel
from controlnet_aux import CannyDetector

canny_detector = CannyDetector()

controlnet = ControlNetModel.from_pretrained(
    "lllyasviel/sd-controlnet-canny",
    torch_dtype=torch.float16
)

pipe = StableDiffusionControlNetPipeline.from_pretrained(
    "stable-diffusion-v1-5/stable-diffusion-v1-5",
    controlnet=controlnet,
    torch_dtype=torch.float16,
    safety_checker=None
).to("cuda")
pipe.enable_attention_slicing()

def run(image: Image.Image, prompt: str) -> Image.Image:
    canny_image = Image.fromarray(canny_detector(np.array(image)))
    images, _ = pipe(
        prompt=prompt,
        image=canny_image,
        num_inference_steps=20,
        return_dict=False
    )
    result: Image.Image = images[0]  # type: ignore[index]
    return result
