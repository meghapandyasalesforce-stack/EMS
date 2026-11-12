import React from "react";
import {
  Box,
  Card,
  CardContent,
  Avatar,
  Typography,
  Chip,
  Slider,
} from "@mui/material";
import { FiCalendar } from "react-icons/fi";
import { format } from "date-fns";

export default function ProjectUpdateFeed({ updates }) {
  return (
    <Box className="project-update-history">
      <Box
        className="project-daily-feed"
        display="flex"
        flexDirection="column"
        gap={2}
      >
        {updates.map((update) => (
          <Card className="project-daily-card" key={update._id} elevation={2}>
            <CardContent>
              <Box
                className="project-daily-card-header"
                display="flex"
                justifyContent="space-between"
                alignItems="flex-start"
                mb={2}
              >
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Avatar
                    sx={{ width: 40, height: 40, bgcolor: "primary.main" }}
                  >
                    {update.postedBy?.name?.charAt(0) || "U"}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {update.postedBy?.name || "Unknown"}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="flex"
                      alignItems="center"
                      gap={0.5}
                    >
                      <FiCalendar size={12} />
                      {format(new Date(update.updateDate), "MMM dd, yyyy")}
                      {" • "}
                      {format(
                        new Date(update.createdAt || update.updateDate),
                        "h:mm a",
                      )}
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  label={update.status}
                  size="small"
                  color={
                    update.status === "completed"
                      ? "success"
                      : update.status === "in-progress"
                        ? "primary"
                        : update.status === "on-hold"
                          ? "warning"
                          : "default"
                  }
                />
              </Box>

              <Typography
                className="project-daily-text"
                variant="body1"
                paragraph
                sx={{ whiteSpace: "pre-wrap" }}
              >
                {update.update}
              </Typography>

              {update.progress !== undefined && (
                <Box className="project-daily-progress" mb={2}>
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Progress
                    </Typography>
                    <Typography variant="caption" fontWeight={600}>
                      {update.progress}%
                    </Typography>
                  </Box>
                  <Slider
                    value={update.progress}
                    min={0}
                    max={100}
                    disabled
                    sx={{ pointerEvents: "none" }}
                  />
                </Box>
              )}

              {update.blockers && (
                <Box className="project-daily-blocker" mb={1}>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    color="error.main"
                  >
                    Blockers:
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 1 }}
                  >
                    {update.blockers}
                  </Typography>
                </Box>
              )}

              {update.nextSteps && (
                <Box className="project-daily-next-steps">
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    color="primary.main"
                  >
                    Next Steps:
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 1 }}
                  >
                    {update.nextSteps}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
