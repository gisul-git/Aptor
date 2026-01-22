from setuptools import setup, find_packages

setup(
    name="hybrid-notebook-agent",
    version="0.1.0",
    description="Local agent for hybrid Jupyter/Colab-like platform",
    author="Your Name",
    packages=find_packages(),
    install_requires=[
        "websockets>=11.0",
        "jupyter-client>=8.0",
        "pyzmq>=25.0",
        "nest-asyncio>=1.5.0",
    ],
    entry_points={
        "console_scripts": [
            "your-agent=agent.__main__:main",
        ],
    },
    python_requires=">=3.10",
)

