import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { type Group, MathUtils } from "three";
import { Wireframe } from "@react-three/drei";

interface DiceProps {
  isHovered: boolean;
}

export const Dice: React.FC<DiceProps> = (props) => {
  const diceRef = useRef<Group>(null);
  const { isHovered } = props;

  useFrame((state, delta) => {
    if (diceRef.current) {
      diceRef.current.rotation.y += (isHovered ? 3 : 1) * delta;
      diceRef.current.rotation.x += (isHovered ? 2 : 0.5) * delta;
    }
  });

  return (
    <group
      ref={diceRef}
      rotation={[
        MathUtils.degToRad(5),
        MathUtils.degToRad(20),
        MathUtils.degToRad(10),
      ]}
    >
      <mesh>
        <icosahedronGeometry args={[20, 0]} />
        <meshBasicMaterial color={isHovered ? `black` : `black`} />
        <Wireframe thickness={0.075} stroke={isHovered ? "red" : "#ff0000"} />
      </mesh>
      {/* <mesh>
        <icosahedronGeometry args={[20, 0]} />
        <meshBasicMaterial color="black" />
      </mesh> */}
    </group>
  );
};
