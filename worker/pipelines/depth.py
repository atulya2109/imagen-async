import torch
from typing import cast
from PIL import Image
from diffusers.pipelines.controlnet.pipeline_controlnet import StableDiffusionControlNetPipeline
from diffusers.models.controlnets.controlnet import ControlNetModel
from controlnet_aux import MidasDetector

depth_detector = MidasDetector.from_pretrained("lllyasviel/Annotators")

controlnet = ControlNetModel.from_pretrained(
    "lllyasviel/sd-controlnet-depth",
    torch_dtype=torch.float16
)

pipe = StableDiffusionControlNetPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    controlnet=controlnet,
    torch_dtype=torch.float16
).to("cuda")

def run(image: Image.Image, prompt: str) -> Image.Image:
    depth_image = cast(Image.Image, depth_detector(image))
    result: Image.Image = pipe(
        prompt=prompt,
        image=depth_image,
        num_inference_steps=20
    ).images[0]  # type: ignore[index]
    return result