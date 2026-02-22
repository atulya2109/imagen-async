import torch
from PIL import Image
from diffusers.pipelines.controlnet.pipeline_controlnet import StableDiffusionControlNetPipeline
from diffusers.models.controlnets.controlnet import ControlNetModel
from controlnet_aux import OpenposeDetector

openpose_detector = OpenposeDetector.from_pretrained("lllyasviel/ControlNet")

controlnet = ControlNetModel.from_pretrained(
    "lllyasviel/sd-controlnet-openpose",
    torch_dtype=torch.float16
)

pipe = StableDiffusionControlNetPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    controlnet=controlnet,
    torch_dtype=torch.float16
).to("cuda")

def run(image: Image.Image, prompt: str) -> Image.Image:
    openpose_image = openpose_detector(image)
    result = pipe(
        prompt=prompt,
        image=openpose_image,
        num_inference_steps=20
    ).images[0] # type: ignore[index]
    return result