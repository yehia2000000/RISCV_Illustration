# RISC-V CV illustration sessions

Interactive walkthroughs of the box-filter kernel, scalar (`ref::BoxFilterNxN`)
and vector (`vec::BoxFilterNxN`), and the median-filter kernel
(`ref::MedianFilterNxN`). The home page lists both sessions.

Convolution uses a **4×3** teaching patch (3×3 kernel, `BorderMode` CONSTANT
0). Interior outputs in column `x = 1` are 50 then 80.

## Get started

```bash
cd illustration
npm install
npm run dev
```

#### WSL: use Linux Node, not Windows npm

On WSL, `which node` should point under `/usr` or `~/.nvm`, not `/mnt/c/...`.
If `npm run dev` prints `UNC paths are not supported` and Next.js cannot find
`app/`, Windows npm is on your PATH. Install Node in WSL, then reinstall deps
from a WSL terminal.  
  
#### Fix

1. Use a Linux Node in WSL:

*nvm* (recommended; matches Node 20 on Windows):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# restart the shell, then:
nvm install 20
nvm use 20
```

*Or apt:*

```bash
sudo apt update && sudo apt install -y nodejs npm
```

2. Confirm you are not on Windows npm:

```bash
which node npm   # paths must NOT start with /mnt/c/
```

3. Reinstall and run from the project root:

```bash
cd ~/workspace/academy/RISCV_Academy/illustration
rm -rf node_modules
npm install
npm run dev
```

### Open [http://localhost:3000](http://localhost:3000). 
That home page lists the box-filter and median-filter sessions.

## Static export

```bash
npm run build
```

HTML is written to `out/`. Host that folder anywhere (no Node server required).

## Routes


| Route                      | What you get                                                                 |
| -------------------------- | ---------------------------------------------------------------------------- |
| `/`                        | Box filter and median filter sessions                                       |
| `/convolution`             | Box filter overview and `ref::BoxFilterNxN` contract                        |
| `/convolution/walkthrough` | Scalar: naive → separable → enhanced on LessonBoard                        |
| `/convolution/vector`      | Lane choice, then the `vec::` RVV kernel                                    |
| `/median`                  | Median concepts: overview and `ref::MedianFilterNxN`                        |
| `/median/naive`            | Naive sort-and-pick lab                                                     |
| `/median/network`          | 5×5 sorting-network lab                                                     |
| `/median/histogram`        | Running-histogram lab                                                       |
| `/median/walkthrough`      | 3×3 network, scalar and vector                                              |

