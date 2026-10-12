import KernelCard from "@/components/KernelCard";
import { KERNELS } from "@/lib/kernels";
import styles from "./home.module.css";

export default function HomePage() {
  return (
    <div className={styles.home}>
      <p className={styles.kicker}>RISC-V CV · kernel sessions</p>
      <h1>Kernel walkthroughs</h1>
      <p className={styles.lead}>
        Interactive lab for the box-filter kernel. Open the session for the
        overview, the scalar walkthrough, and the vector walkthrough.
      </p>

      <div className={styles.grid}>
        {KERNELS.map((kernel) => (
          <KernelCard key={kernel.id} kernel={kernel} />
        ))}
      </div>
    </div>
  );
}
