import { GroupCommand } from "src/core/GroupCommand";
import { BucketAddCommand } from "./add";
import { BucketKnownCommand } from "./known";
import { BucketListCommand } from "./list";
import { BucketRemoveCommand } from "./remove";

import { BucketUnusedCommand } from "./unused";
import { BucketUpdateCommand } from "./update";

export class BucketCommand extends GroupCommand {
    name = "bucket";
    description = "Manage Scoop buckets - repositories containing app manifests.";

    constructor() {
        super();
        this.subcommands = [
            new BucketListCommand(),
            new BucketKnownCommand(),
            new BucketAddCommand(),
            new BucketRemoveCommand(),
            new BucketUnusedCommand(),
            new BucketUpdateCommand(),
        ];
        this.examples = [
            "swb bucket list",
            "swb bucket add extras",
            "swb bucket remove extras --force",
            "swb bucket known",
            "swb bucket update",
            "swb bucket update extras --changelog",
            "swb bucket unused",
        ];
    }
}
